const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    createCdcMessageProcessor,
    createMerkleBatchProcessor,
} = require('./cdc-flow');

function createLogger() {
    const events = [];

    return {
        events,
        info(event, fields = {}) {
            events.push({ level: 'info', event, fields });
        },
        warn(event, fields = {}) {
            events.push({ level: 'warn', event, fields });
        },
        audit(event, fields = {}) {
            events.push({ level: 'audit', event, fields });
        },
        error(event, error, fields = {}) {
            events.push({ level: 'error', event, error, fields });
        },
    };
}

describe('CDC provider contracts', () => {
    it('rejects repositories that do not implement the required contract', () => {
        const logger = createLogger();

        assert.throws(
            () => createCdcMessageProcessor({
                messageDecoder: { decode() { return {}; } },
                timestampAuthority: { async getTimestamp() { return {}; } },
                complianceEvaluator: { detect() { return []; } },
                repository: { storeCdcEvent() { } },
                logger,
            }),
            /storeViolationEvidence/
        );
    });

    it('processes CDC events through provider interfaces', async () => {
        const logger = createLogger();
        const calls = [];

        const processMessage = createCdcMessageProcessor({
            messageDecoder: {
                decode(message) {
                    return JSON.parse(message.value.toString()).payload;
                },
            },
            timestampAuthority: {
                async getTimestamp() {
                    return {
                        timestamp: '2026-04-07T09:00:00.000Z',
                        source: 'ntp://pool.ntp.org',
                    };
                },
            },
            complianceEvaluator: {
                detect(table, operation, after) {
                    calls.push({ table, operation, after });
                    return [
                        {
                            violationCode: 'SAMA-CP-001',
                            authority: 'SAMA',
                            severity: 'high',
                            title: 'Disclosure Font Size Below 14pt',
                            description: 'Digital disclosure rendered at 11pt',
                        },
                    ];
                },
            },
            repository: {
                async storeCdcEvent() {
                    return 77;
                },
                async storeViolationEvidence() {
                    return {
                        evidenceId: 91,
                        hash: 'abc123def4567890',
                        inserted: true,
                    };
                },
            },
            logger,
        });

        await processMessage({
            value: Buffer.from(JSON.stringify({
                payload: {
                    op: 'u',
                    after: { font_size_pt: 11 },
                    source: {
                        db: 'client_banking',
                        table: 'consumer_disclosures',
                    },
                },
            })),
        });

        assert.equal(calls.length, 1);
        assert.equal(calls[0].operation, 'UPDATE');
        assert.ok(logger.events.some((entry) => entry.event === 'cdc.event_ingested'));
        assert.ok(logger.events.some((entry) => entry.event === 'evidence.sealed'));
    });

    it('builds merkle batches through provider interfaces', async () => {
        const logger = createLogger();
        let storedBatch = null;

        const computeDailyMerkle = createMerkleBatchProcessor({
            repository: {
                async loadEvidenceHashesForDate(batchDate) {
                    assert.equal(batchDate, '2026-04-07');
                    return ['hash-a', 'hash-b'];
                },
                async storeMerkleBatch(batch) {
                    storedBatch = batch;
                },
            },
            logger,
        });

        const result = await computeDailyMerkle('2026-04-07');

        assert.equal(result.batchDate, '2026-04-07');
        assert.equal(result.evidenceCount, 2);
        assert.ok(result.merkleRoot);
        assert.equal(storedBatch.batchDate, '2026-04-07');
        assert.ok(logger.events.some((entry) => entry.event === 'evidence.merkle_batch_sealed'));
    });
});
