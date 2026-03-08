// ============================================
// SAQR Sentinel — Sovereign Bridge
// Secure rule ingestion pipeline:
// Public Zone → SHA-256 Hash → Private Zone (PostgreSQL)
// One-way encrypted stream. No client data exits.
// ============================================

const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.SHADOW_DB_HOST || 'localhost',
    port: parseInt(process.env.SHADOW_DB_PORT || '5432', 10),
    database: process.env.SHADOW_DB_NAME || 'saqr_shadow',
    user: process.env.SHADOW_DB_USER || 'saqr',
    password: process.env.SHADOW_DB_PASSWORD || 'saqr_dev_password',
});

/**
 * Hash rule content for integrity verification.
 * @param {string} text - Rule text to hash
 * @returns {string} SHA-256 hex digest
 */
function hashRule(text) {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Ingest scraped rules into the regulatory_staging table.
 * Uses ON CONFLICT DO NOTHING for deduplication via content_hash.
 *
 * @param {Array<{authority: string, title: string, sourceUrl: string, contentHash: string, detectedAt: string}>} rules
 * @returns {Promise<{ingested: number, duplicates: number}>}
 */
async function ingestRules(rules) {
    if (!rules || rules.length === 0) {
        return { ingested: 0, duplicates: 0 };
    }

    let ingested = 0;
    let duplicates = 0;

    for (const rule of rules) {
        try {
            const result = await pool.query(
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

            if (result.rowCount > 0) {
                ingested++;
                console.log(`[BRIDGE] ✅ Ingested: ${rule.authority} — "${rule.title.substring(0, 60)}..." (${rule.contentHash.substring(0, 12)}…)`);
            } else {
                duplicates++;
            }
        } catch (err) {
            console.error(`[BRIDGE] ❌ Ingestion error for "${rule.title}": ${err.message}`);
        }
    }

    console.log(`[BRIDGE] Summary: ${ingested} new, ${duplicates} duplicates, ${rules.length} total`);
    return { ingested, duplicates };
}

/**
 * Simulated ingestion for demo mode (no DB required).
 * Logs to console as if rules were ingested.
 *
 * @param {Array} rules
 * @returns {{ingested: number, duplicates: number}}
 */
function ingestRulesDemo(rules) {
    if (!rules || rules.length === 0) {
        return { ingested: 0, duplicates: 0 };
    }

    console.log(`[BRIDGE-DEMO] 🔒 Sovereign Bridge — Ingesting ${rules.length} rules`);
    rules.forEach((rule, i) => {
        console.log(`  ${i + 1}. [${rule.authority}] ${rule.title.substring(0, 70)} → ${rule.contentHash.substring(0, 16)}…`);
    });
    console.log(`[BRIDGE-DEMO] ✅ All ${rules.length} rules processed (demo mode, no DB write)`);
    return { ingested: rules.length, duplicates: 0 };
}

/**
 * Close the database connection pool.
 */
async function closePool() {
    await pool.end();
}

module.exports = { hashRule, ingestRules, ingestRulesDemo, closePool, pool };
