// ============================================
// SAQR — Compliance Engine Unit Tests
// ============================================

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { detectViolations } = require('./compliance-engine');

describe('SAMA-CP-001: Font Size Compliance', () => {
    it('detects font size below 14pt', () => {
        const violations = detectViolations('consumer_disclosures', 'INSERT', {
            product_id: 'PL-001',
            product_name: 'Personal Loan',
            font_size_pt: 12,
            channel: 'branch',
        });
        assert.equal(violations.length, 1);
        assert.equal(violations[0].violationCode, 'SAMA-CP-001');
        assert.equal(violations[0].authority, 'SAMA');
        assert.equal(violations[0].severity, 'high');
    });

    it('does NOT flag font size ≥ 14pt', () => {
        const violations = detectViolations('consumer_disclosures', 'INSERT', {
            product_id: 'PL-001',
            product_name: 'Personal Loan',
            font_size_pt: 14,
        });
        assert.equal(violations.length, 0);
    });

    it('does NOT flag font size = 16pt', () => {
        const violations = detectViolations('consumer_disclosures', 'UPDATE', {
            product_id: 'PL-001',
            font_size_pt: 16,
        });
        assert.equal(violations.length, 0);
    });
});

describe('MOMAH Branch Compliance', () => {
    it('detects non-compliant signage', () => {
        const violations = detectViolations('branch_compliance', 'UPDATE', {
            branch_code: 'RUH-001',
            branch_name: 'Riyadh Main',
            municipality: 'Riyadh',
            signage_status: 'non_compliant',
            lighting_status: 'compliant',
        });
        assert.equal(violations.length, 1);
        assert.equal(violations[0].violationCode, 'MOMAH-BR-001');
    });

    it('detects multiple violations at one branch', () => {
        const violations = detectViolations('branch_compliance', 'INSERT', {
            branch_code: 'JED-001',
            branch_name: 'Jeddah Corniche',
            municipality: 'Jeddah',
            signage_status: 'non_compliant',
            lighting_status: 'non_compliant',
            license_expiry: '2020-01-01', // expired
        });
        assert.equal(violations.length, 3);
        const codes = violations.map(v => v.violationCode);
        assert.ok(codes.includes('MOMAH-BR-001'));
        assert.ok(codes.includes('MOMAH-BR-002'));
        assert.ok(codes.includes('MOMAH-BR-003'));
    });

    it('returns empty for fully compliant branch', () => {
        const violations = detectViolations('branch_compliance', 'UPDATE', {
            branch_code: 'DMM-001',
            branch_name: 'Dammam',
            municipality: 'Dammam',
            signage_status: 'compliant',
            lighting_status: 'compliant',
            license_expiry: '2027-12-31',
        });
        assert.equal(violations.length, 0);
    });
});

describe('DELETE operations', () => {
    it('DELETE operations never generate violations', () => {
        const violations = detectViolations('consumer_disclosures', 'DELETE', {
            font_size_pt: 8,
        });
        assert.equal(violations.length, 0);
    });
});
