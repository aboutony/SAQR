const { computeHash, hashCdcEvent, computeMerkleRoot } = require('./hasher');
const { detectViolations } = require('./compliance-engine');
const { getNtpTimestamp } = require('./ntp');
const { assertProviderContract } = require('../../../shared/provider-contract');

function createDebeziumMessageDecoder() {
    return {
        decode(message) {
            const parsed = JSON.parse(message.value.toString());
            return parsed.payload || parsed;
        },
    };
}

function createNtpTimestampAuthority(config, logger) {
    return {
        async getTimestamp() {
            return getNtpTimestamp(config.server, config.timeoutMs, {
                allowSystemClockFallback: config.allowSystemClockFallback,
                logger,
            });
        },
    };
}

function createComplianceEvaluator() {
    return {
        detect(table, operation, record) {
            return detectViolations(table, operation, record);
        },
    };
}

function createPostgresEvidenceRepository(queryAdapter) {
    assertProviderContract('cdc.queryAdapter', queryAdapter, ['query']);

    return {
        async storeCdcEvent(event, timestampAuthorityRecord, hash) {
            const result = await queryAdapter.query(
                `INSERT INTO shadow.cdc_events
           (source_system, source_table, operation, before_state, after_state, event_timestamp, sha256_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
                [
                    event.source?.db || 'unknown',
                    event.source?.table || 'unknown',
                    event.op === 'c' ? 'INSERT' : event.op === 'u' ? 'UPDATE' : event.op === 'd' ? 'DELETE' : event.op === 'r' ? 'INSERT' : 'UNKNOWN',
                    event.before ? JSON.stringify(event.before) : null,
                    event.after ? JSON.stringify(event.after) : null,
                    timestampAuthorityRecord.timestamp,
                    hash,
                ]
            );

            return result.rows[0].id;
        },

        async storeViolationEvidence(violation, timestampAuthorityRecord) {
            const payload = {
                ...violation,
                ntp_timestamp: timestampAuthorityRecord.timestamp,
                ntp_source: timestampAuthorityRecord.source,
            };
            const hash = computeHash(payload);

            const result = await queryAdapter.query(
                `INSERT INTO vault.evidence
           (evidence_type, source_module, violation_code, authority, severity, title, description, raw_payload, sha256_hash, ntp_timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (sha256_hash) DO NOTHING
         RETURNING id`,
                [
                    'cdc_violation',
                    'compliance-engine',
                    violation.violationCode,
                    violation.authority,
                    violation.severity,
                    violation.title,
                    violation.description,
                    JSON.stringify(payload),
                    hash,
                    timestampAuthorityRecord.timestamp,
                ]
            );

            return {
                evidenceId: result.rows[0]?.id || null,
                hash,
                inserted: result.rows.length > 0,
            };
        },

        async loadEvidenceHashesForDate(batchDate) {
            const result = await queryAdapter.query(
                `SELECT sha256_hash FROM vault.evidence
         WHERE DATE(ntp_timestamp) = $1
         ORDER BY id`,
                [batchDate]
            );

            return result.rows.map((row) => row.sha256_hash);
        },

        async storeMerkleBatch({ batchDate, evidenceCount, merkleRoot, leafHashes }) {
            return queryAdapter.query(
                `INSERT INTO vault.merkle_log (batch_date, evidence_count, merkle_root, leaf_hashes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (batch_date) DO NOTHING`,
                [batchDate, evidenceCount, merkleRoot, leafHashes]
            );
        },
    };
}

function createCdcMessageProcessor({
    messageDecoder,
    timestampAuthority,
    complianceEvaluator,
    repository,
    logger,
}) {
    const decoderProvider = assertProviderContract('cdc.messageDecoder', messageDecoder, ['decode']);
    const clockProvider = assertProviderContract('cdc.timestampAuthority', timestampAuthority, ['getTimestamp']);
    const evaluatorProvider = assertProviderContract('cdc.complianceEvaluator', complianceEvaluator, ['detect']);
    const repositoryProvider = assertProviderContract('cdc.repository', repository, [
        'storeCdcEvent',
        'storeViolationEvidence',
    ]);

    return async function processMessage(message) {
        let event;
        try {
            event = decoderProvider.decode(message);
        } catch (error) {
            logger.error('cdc.message_parse_failed', error);
            return;
        }

        const table = event.source?.table;
        const operation = event.op;

        if (!table || !operation) {
            logger.warn('cdc.message_skipped_missing_metadata', {
                hasTable: Boolean(table),
                hasOperation: Boolean(operation),
            });
            return;
        }

        const timestampRecord = await clockProvider.getTimestamp();
        const eventHash = hashCdcEvent(event, timestampRecord.timestamp);
        const cdcEventId = await repositoryProvider.storeCdcEvent(event, timestampRecord, eventHash);

        logger.info('cdc.event_ingested', {
            cdcEventId,
            sourceTable: table,
            operation,
            hashPrefix: eventHash.substring(0, 12),
            ntpSource: timestampRecord.source,
        });

        const operationMap = { c: 'INSERT', u: 'UPDATE', d: 'DELETE', r: 'INSERT' };
        const violations = evaluatorProvider.detect(table, operationMap[operation] || operation, event.after);
        if (violations.length > 0) {
            logger.audit('cdc.violations_detected', {
                sourceTable: table,
                operation,
                violationCount: violations.length,
            });
        }

        for (const violation of violations) {
            const result = await repositoryProvider.storeViolationEvidence(violation, timestampRecord);
            if (result.inserted) {
                logger.audit('evidence.sealed', {
                    evidenceId: result.evidenceId,
                    violationCode: violation.violationCode,
                    authority: violation.authority,
                    severity: violation.severity,
                    ntpSource: timestampRecord.source,
                });
            } else {
                logger.info('evidence.duplicate_skipped', {
                    hashPrefix: result.hash.substring(0, 12),
                    violationCode: violation.violationCode,
                });
            }
        }
    };
}

function createMerkleBatchProcessor({ repository, logger }) {
    const repositoryProvider = assertProviderContract('cdc.repository', repository, [
        'loadEvidenceHashesForDate',
        'storeMerkleBatch',
    ]);

    return async function computeDailyMerkle(batchDate = new Date().toISOString().split('T')[0]) {
        const hashes = await repositoryProvider.loadEvidenceHashesForDate(batchDate);

        if (hashes.length === 0) {
            logger.info('merkle.batch.skipped_empty', { batchDate });
            return null;
        }

        const merkleRoot = computeMerkleRoot(hashes);

        try {
            await repositoryProvider.storeMerkleBatch({
                batchDate,
                evidenceCount: hashes.length,
                merkleRoot,
                leafHashes: hashes,
            });
            logger.audit('evidence.merkle_batch_sealed', {
                batchDate,
                evidenceCount: hashes.length,
                merkleRoot,
            });
        } catch (error) {
            logger.info('merkle.batch.already_sealed', { batchDate });
        }

        return {
            batchDate,
            evidenceCount: hashes.length,
            merkleRoot,
        };
    };
}

module.exports = {
    createCdcMessageProcessor,
    createComplianceEvaluator,
    createDebeziumMessageDecoder,
    createMerkleBatchProcessor,
    createNtpTimestampAuthority,
    createPostgresEvidenceRepository,
};
