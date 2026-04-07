// ============================================
// SAQR Sentinel - Sovereign Bridge
// Secure rule ingestion pipeline:
// Public Zone -> SHA-256 Hash -> Private Zone (PostgreSQL)
// One-way encrypted stream. No client data exits.
// ============================================

const crypto = require('crypto');
const { Pool } = require('pg');
const { buildSentinelConfig } = require('./config');
const { createServiceLogger } = require('../../../shared/observability');
const { assertProviderContract } = require('../../../shared/provider-contract');
const { createPostgresAdapter } = require('../../../shared/postgres-adapter');

const config = buildSentinelConfig(process.env);
const pool = new Pool(config.db);
const logger = createServiceLogger({ service: 'saqr-sentinel', runtime: config.runtime });
const db = createPostgresAdapter(pool, {
    name: 'saqr-sentinel-bridge-db',
    logger,
});

/**
 * Hash rule content for integrity verification.
 * @param {string} text - Rule text to hash
 * @returns {string} SHA-256 hex digest
 */
function hashRule(text) {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function createPostgresRegulatoryStagingRepository(queryAdapter) {
    assertProviderContract('sentinel.stagingDb', queryAdapter, ['query']);

    return {
        async upsertRule(rule) {
            const result = await queryAdapter.query(
                `INSERT INTO shadow.regulatory_staging
           (authority, title, source_url, content_hash, detected_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (content_hash) DO NOTHING`,
                [
                    rule.authority,
                    rule.title,
                    rule.sourceUrl,
                    rule.contentHash,
                    rule.detectedAt || new Date().toISOString(),
                ]
            );

            return {
                inserted: result.rowCount > 0,
                duplicate: result.rowCount === 0,
            };
        },
    };
}

function createRegulatoryStagingIngestionFlow({ repository, logger }) {
    const repositoryProvider = assertProviderContract('sentinel.stagingRepository', repository, ['upsertRule']);

    return async function ingestRules(rules) {
        if (!rules || rules.length === 0) {
            return { ingested: 0, duplicates: 0 };
        }

        let ingested = 0;
        let duplicates = 0;

        for (const rule of rules) {
            try {
                const result = await repositoryProvider.upsertRule(rule);

                if (result.inserted) {
                    ingested++;
                    logger.info('bridge.rule_ingested', {
                        authority: rule.authority,
                        titlePreview: rule.title.substring(0, 60),
                        hashPrefix: rule.contentHash.substring(0, 12),
                    });
                } else {
                    duplicates++;
                }
            } catch (err) {
                logger.error('bridge.rule_ingestion_failed', err, {
                    authority: rule.authority,
                    title: rule.title,
                });
            }
        }

        logger.info('bridge.ingestion_summary', {
            ingested,
            duplicates,
            total: rules.length,
        });
        return { ingested, duplicates };
    };
}

/**
 * Ingest scraped rules into the regulatory_staging table.
 * Uses ON CONFLICT DO NOTHING for deduplication via content_hash.
 *
 * @param {Array<{authority: string, title: string, sourceUrl: string, contentHash: string, detectedAt: string}>} rules
 * @returns {Promise<{ingested: number, duplicates: number}>}
 */
const ingestRules = createRegulatoryStagingIngestionFlow({
    repository: createPostgresRegulatoryStagingRepository(db),
    logger,
});

/**
 * Simulated ingestion for demo mode (no DB required).
 * Logs as if rules were ingested.
 *
 * @param {Array} rules
 * @returns {{ingested: number, duplicates: number}}
 */
function ingestRulesDemo(rules) {
    if (!rules || rules.length === 0) {
        return { ingested: 0, duplicates: 0 };
    }

    logger.info('bridge.demo_ingestion_started', {
        total: rules.length,
    });
    rules.forEach((rule, index) => {
        logger.debug('bridge.demo_rule_processed', {
            index: index + 1,
            authority: rule.authority,
            titlePreview: rule.title.substring(0, 70),
            hashPrefix: rule.contentHash.substring(0, 16),
        });
    });
    logger.info('bridge.demo_ingestion_completed', {
        total: rules.length,
        ingested: rules.length,
    });
    return { ingested: rules.length, duplicates: 0 };
}

/**
 * Close the database connection pool.
 */
async function closePool() {
    await db.close();
}

async function testBridgeConnection() {
    return db.healthcheck();
}

module.exports = {
    createPostgresRegulatoryStagingRepository,
    createRegulatoryStagingIngestionFlow,
    hashRule,
    ingestRules,
    ingestRulesDemo,
    closePool,
    testBridgeConnection,
    pool,
};
