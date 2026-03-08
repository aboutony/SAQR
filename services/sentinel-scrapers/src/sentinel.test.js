// ============================================
// SAQR Sentinel — Unit Tests
// Tests extraction logic, bridge hashing,
// and deduplication without network/DB access.
// ============================================

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { scrapeSAMADemo } = require('./sama-scraper');
const { scrapeSDAIADemo } = require('./sdaia-scraper');
const { hashRule, ingestRulesDemo } = require('./bridge');

// -----------------------------------------------
// SAMA Demo Scraper Tests
// -----------------------------------------------
describe('SAMA Demo Scraper', () => {
    it('should return an array of circulars', () => {
        const results = scrapeSAMADemo();
        assert.ok(Array.isArray(results), 'Results should be an array');
        assert.ok(results.length > 0, 'Should return at least one circular');
    });

    it('should have correct authority field', () => {
        const results = scrapeSAMADemo();
        results.forEach(r => {
            assert.equal(r.authority, 'SAMA');
        });
    });

    it('should include all required fields', () => {
        const results = scrapeSAMADemo();
        const required = ['authority', 'title', 'sourceUrl', 'contentHash', 'detectedAt'];
        results.forEach(r => {
            required.forEach(field => {
                assert.ok(r[field], `Missing field: ${field}`);
            });
        });
    });

    it('should generate unique SHA-256 hashes for each entry', () => {
        const results = scrapeSAMADemo();
        const hashes = results.map(r => r.contentHash);
        const uniqueHashes = [...new Set(hashes)];
        assert.equal(hashes.length, uniqueHashes.length, 'All hashes should be unique');
    });

    it('should produce 64-char hex hashes', () => {
        const results = scrapeSAMADemo();
        results.forEach(r => {
            assert.equal(r.contentHash.length, 64, 'SHA-256 hex should be 64 chars');
            assert.match(r.contentHash, /^[a-f0-9]{64}$/, 'Should be valid hex');
        });
    });
});

// -----------------------------------------------
// SDAIA Demo Scraper Tests
// -----------------------------------------------
describe('SDAIA Demo Scraper', () => {
    it('should return an array of news entries', () => {
        const results = scrapeSDAIADemo();
        assert.ok(Array.isArray(results), 'Results should be an array');
        assert.ok(results.length > 0, 'Should return at least one entry');
    });

    it('should have correct authority field', () => {
        const results = scrapeSDAIADemo();
        results.forEach(r => {
            assert.equal(r.authority, 'SDAIA');
        });
    });

    it('should categorize entries as PDPL Enforcement or AI Governance', () => {
        const results = scrapeSDAIADemo();
        const validCategories = ['PDPL Enforcement', 'AI Governance'];
        results.forEach(r => {
            assert.ok(validCategories.includes(r.category), `Invalid category: ${r.category}`);
        });
    });
});

// -----------------------------------------------
// Bridge Hashing Tests
// -----------------------------------------------
describe('Sovereign Bridge — hashRule', () => {
    it('should produce consistent SHA-256 hashes', () => {
        const hash1 = hashRule('Test rule text');
        const hash2 = hashRule('Test rule text');
        assert.equal(hash1, hash2, 'Same input should produce same hash');
    });

    it('should produce different hashes for different inputs', () => {
        const hash1 = hashRule('Rule A');
        const hash2 = hashRule('Rule B');
        assert.notEqual(hash1, hash2, 'Different inputs should produce different hashes');
    });

    it('should match Node.js crypto directly', () => {
        const input = 'SAMA|Circular: Test|2026-01-01';
        const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
        const actual = hashRule(input);
        assert.equal(actual, expected);
    });
});

// -----------------------------------------------
// Bridge Demo Ingestion Tests
// -----------------------------------------------
describe('Sovereign Bridge — Demo Ingestion', () => {
    it('should handle empty array gracefully', () => {
        const result = ingestRulesDemo([]);
        assert.equal(result.ingested, 0);
        assert.equal(result.duplicates, 0);
    });

    it('should report all rules as ingested in demo mode', () => {
        const rules = scrapeSAMADemo();
        const result = ingestRulesDemo(rules);
        assert.equal(result.ingested, rules.length);
        assert.equal(result.duplicates, 0);
    });

    it('should handle null input', () => {
        const result = ingestRulesDemo(null);
        assert.equal(result.ingested, 0);
    });
});
