// ============================================
// SAQR Evidence Vault — Hasher Unit Tests
// ============================================

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeHash, hashCdcEvent, computeMerkleRoot, verifyHash } = require('./hasher');

describe('computeHash', () => {
    it('produces a 64-char hex string for string input', () => {
        const hash = computeHash('hello saqr');
        assert.equal(hash.length, 64);
        assert.match(hash, /^[a-f0-9]{64}$/);
    });

    it('produces deterministic hashes', () => {
        const h1 = computeHash('test payload');
        const h2 = computeHash('test payload');
        assert.equal(h1, h2);
    });

    it('produces deterministic hashes for objects regardless of key order', () => {
        const h1 = computeHash({ b: 2, a: 1 });
        const h2 = computeHash({ a: 1, b: 2 });
        assert.equal(h1, h2);
    });

    it('produces different hashes for different payloads', () => {
        const h1 = computeHash('payload_a');
        const h2 = computeHash('payload_b');
        assert.notEqual(h1, h2);
    });
});

describe('hashCdcEvent', () => {
    it('includes NTP timestamp in the hash', () => {
        const event = { source: { db: 'client_banking', table: 'disclosures' }, op: 'c', after: { id: 1 } };
        const h1 = hashCdcEvent(event, '2026-01-01T00:00:00.000Z');
        const h2 = hashCdcEvent(event, '2026-01-01T00:00:01.000Z');
        assert.notEqual(h1, h2, 'Different timestamps must produce different hashes');
    });
});

describe('computeMerkleRoot', () => {
    it('returns leaf hash for single element', () => {
        const hash = computeHash('leaf');
        const root = computeMerkleRoot([hash]);
        assert.equal(root, hash);
    });

    it('computes root for two leaves', () => {
        const h1 = computeHash('leaf1');
        const h2 = computeHash('leaf2');
        const root = computeMerkleRoot([h1, h2]);
        assert.equal(root.length, 64);
        assert.notEqual(root, h1);
        assert.notEqual(root, h2);
    });

    it('handles odd number of leaves by duplicating last', () => {
        const h1 = computeHash('a');
        const h2 = computeHash('b');
        const h3 = computeHash('c');
        const root = computeMerkleRoot([h1, h2, h3]);
        assert.equal(root.length, 64);
    });

    it('returns deterministic root for empty batch', () => {
        const root = computeMerkleRoot([]);
        assert.equal(root.length, 64);
    });
});

describe('verifyHash', () => {
    it('returns true for matching payload', () => {
        const payload = { key: 'value' };
        const hash = computeHash(payload);
        assert.equal(verifyHash(payload, hash), true);
    });

    it('returns false for tampered payload', () => {
        const hash = computeHash({ key: 'value' });
        assert.equal(verifyHash({ key: 'tampered' }, hash), false);
    });
});
