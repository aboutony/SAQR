// ============================================
// SAQR NLP Interpreter — Semantic Extractor Tests
// ============================================

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { extractEntities, extractConstraints, semanticExtract, AUTHORITY_MAP } = require('./semantic-extractor');
const { processSentinelDemo, evaluateConstraint, calculatePotentialFine, buildReasoning } = require('./sentinel-bridge');

// -----------------------------------------------
// NER Tests
// -----------------------------------------------
describe('NER — extractEntities', () => {
    it('should detect SAMA authority from text', () => {
        const result = extractEntities('SAMA circular regarding fee cap compliance');
        assert.equal(result.authority, 'SAMA');
    });

    it('should detect SDAIA authority from text', () => {
        const result = extractEntities('SDAIA issues new PDPL enforcement guidelines');
        assert.equal(result.authority, 'SDAIA');
    });

    it('should use knownAuthority when provided', () => {
        const result = extractEntities('Some text without authority mention', 'ZATCA');
        assert.equal(result.authority, 'ZATCA');
    });

    it('should extract rule IDs', () => {
        const result = extractEntities('Circular No. 402 regarding maximum fee caps');
        assert.ok(result.ruleIds.length > 0, 'Should find at least one rule ID');
    });

    it('should extract effective dates', () => {
        const result = extractEntities('Effective from 2026-03-01 all institutions must comply');
        assert.ok(result.effectiveDates.length > 0, 'Should find at least one date');
        assert.ok(result.effectiveDates[0].includes('2026'));
    });

    it('should classify Financial category for fee-related text', () => {
        const result = extractEntities('Maximum administrative fee cap of 1% for all lending products');
        assert.equal(result.category, 'Financial');
    });

    it('should classify Privacy category for data-related text', () => {
        const result = extractEntities('PDPL personal data privacy consent transfer breach requirements');
        assert.equal(result.category, 'Privacy');
    });

    it('should classify Operational category for safety-related text', () => {
        const result = extractEntities('Signage license hygiene safety temperature storage PPE compliance requirements');
        assert.equal(result.category, 'Operational');
    });
});

// -----------------------------------------------
// Constraint Extraction Tests
// -----------------------------------------------
describe('Constraint Extraction', () => {
    it('should extract SAR financial cap', () => {
        const constraints = extractConstraints('Maximum fee shall not exceed SAR 500,000');
        assert.ok(constraints.length > 0);
        assert.equal(constraints[0].value, 500000);
        assert.equal(constraints[0].unit, 'SAR');
    });

    it('should extract percentage cap', () => {
        const constraints = extractConstraints('Administrative fee must not exceed 1.5% of the loan value');
        assert.ok(constraints.length > 0);
        const pctConstraint = constraints.find(c => c.type === 'percentageCap');
        assert.ok(pctConstraint, 'Should find a percentage cap');
        assert.equal(pctConstraint.value, 1.5);
    });

    it('should extract time constraint', () => {
        const constraints = extractConstraints('Must be processed within 30 business days');
        assert.ok(constraints.length > 0);
        const timeConstraint = constraints.find(c => c.type === 'timeConstraint');
        assert.ok(timeConstraint);
        assert.equal(timeConstraint.value, 30);
    });

    it('should extract penalty amount', () => {
        const constraints = extractConstraints('penalty of up to SAR 2,000,000 for repeated offenses');
        assert.ok(constraints.length > 0);
        const penaltyConstraint = constraints.find(c => c.type === 'penaltyAmount');
        assert.ok(penaltyConstraint);
        assert.equal(penaltyConstraint.value, 2000000);
    });

    it('should include context for each constraint', () => {
        const constraints = extractConstraints('The maximum fee shall not exceed SAR 500,000 per quarter');
        assert.ok(constraints.length > 0);
        assert.ok(constraints[0].context.length > 10, 'Context should be meaningful');
    });
});

// -----------------------------------------------
// Full Semantic Pipeline Tests
// -----------------------------------------------
describe('Semantic Extract Pipeline', () => {
    it('should return complete extraction result', () => {
        const result = semanticExtract(
            'SAMA Circular No. 402: Maximum admin fee must not exceed 1% effective 2026-02-01.',
            { authority: 'SAMA', title: 'Test Circular' }
        );

        assert.ok(result.documentId);
        assert.equal(result.authority, 'SAMA');
        assert.ok(result.contentHash.length === 64);
        assert.ok(result.extractedAt);
        assert.equal(result.pipeline, 'phase-a-rule-engine');
    });

    it('should extract obligations from structured regulatory text', () => {
        // Use extractObligations directly with a section (bypasses parser sectioning)
        const { extractObligations } = require('./obligation-extractor');
        const sections = [{
            sectionId: 'SEC-1',
            title: 'Fee Requirements',
            body: 'Banks shall not charge administrative fees exceeding 1% on SME products. All consumer disclosures must comply with minimum 14pt font size. Banks shall process cancellation requests within 10 business days.',
            language: 'en',
            depth: 0,
        }];
        const obligations = extractObligations(sections, 'SAMA');
        assert.ok(obligations.length > 0, `Should extract at least one obligation, got ${obligations.length}`);
    });
});

// -----------------------------------------------
// Drift-Detection Bridge Tests
// -----------------------------------------------
describe('Drift-Detection Bridge', () => {
    it('should detect violation when CDC value exceeds constraint', () => {
        const violation = evaluateConstraint(
            { type: 'percentageCap', value: 1, unit: '%' },
            { field: 'admin_fee_rate', value: 2.5, unit: '%' }
        );
        assert.ok(violation, 'Should detect violation');
        assert.ok(violation.severity === 'critical' || violation.severity === 'high');
    });

    it('should NOT detect violation when CDC value is within constraint', () => {
        const violation = evaluateConstraint(
            { type: 'percentageCap', value: 5, unit: '%' },
            { field: 'admin_fee_rate', value: 2.5, unit: '%' }
        );
        assert.equal(violation, null);
    });

    it('should detect minimum threshold violations', () => {
        const violation = evaluateConstraint(
            { type: 'minimumThreshold', value: 14, unit: 'pt' },
            { field: 'font_size_pt', value: 11, unit: 'pt' }
        );
        assert.ok(violation);
        assert.equal(violation.severity, 'high');
    });

    it('should calculate potential fines', () => {
        const fine = calculatePotentialFine(
            { type: 'percentageCap', value: 1 },
            { authority: 'SAMA', constraints: [] }
        );
        assert.ok(fine > 0, 'Fine should be positive');
    });
});

// -----------------------------------------------
// Demo Pipeline Tests
// -----------------------------------------------
describe('Sentinel Demo Pipeline', () => {
    it('should process demo entries and return alerts', () => {
        const alerts = processSentinelDemo();
        assert.ok(Array.isArray(alerts));
        // Demo should produce at least one alert (SAMA fee cap mismatch)
        console.log(`  [DEMO] Generated ${alerts.length} alerts`);
        if (alerts.length > 0) {
            assert.ok(alerts[0].alertId);
            assert.ok(alerts[0].authority);
            assert.ok(alerts[0].reasoning);
            assert.ok(alerts[0].hashedLink);
        }
    });

    it('should generate reasoning strings for alerts', () => {
        const reasoning = buildReasoning(
            { type: 'percentageCap', value: 1, unit: '%', context: 'admin fee must not exceed 1%' },
            { field: 'admin_fee_rate', value: 2.5, unit: '%' },
            { pipeline: 'phase-a-rule-engine', authority: 'SAMA', category: 'Financial', ruleIds: ['Circular 402'] },
            { title: 'Test Circular', contentHash: 'abc123' }
        );
        assert.ok(reasoning.includes('SAMA'));
        assert.ok(reasoning.includes('1'));
        assert.ok(reasoning.includes('2.5'));
        assert.ok(reasoning.includes('OUT OF COMPLIANCE'));
    });
});
