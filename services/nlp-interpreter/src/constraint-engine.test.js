const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    DEFAULT_CONSTRAINT_RULESETS,
    buildReasoning,
    createConstraintEvaluationService,
    createKeywordFieldMatcher,
} = require('./constraint-engine');

describe('Constraint evaluation engine', () => {
    it('registers the expected default constraint rulesets', () => {
        assert.equal(DEFAULT_CONSTRAINT_RULESETS.length, 3);
    });

    it('evaluates percentage-cap violations through the modular engine', () => {
        const engine = createConstraintEvaluationService();
        const violation = engine.evaluateConstraint(
            { type: 'percentageCap', value: 1, unit: '%' },
            { field: 'admin_fee_rate', value: 2.5, unit: '%' }
        );

        assert.ok(violation);
        assert.equal(violation.severity, 'critical');
    });

    it('matches fields using the keyword matcher', () => {
        const matcher = createKeywordFieldMatcher();
        assert.equal(
            matcher.matches(
                { context: 'admin fee must not exceed 1%' },
                'admin_fee_rate'
            ),
            true
        );
    });

    it('compares extracted constraints to CDC values through the modular engine', () => {
        const engine = createConstraintEvaluationService();
        const alerts = engine.compareConstraintsToCDC(
            {
                authority: 'SAMA',
                pipeline: 'phase-a-rule-engine',
                category: 'Financial',
                ruleIds: ['Circular 402'],
                constraints: [
                    { type: 'percentageCap', value: 1, unit: '%', context: 'admin fee must not exceed 1%' },
                ],
            },
            {
                authority: 'SAMA',
                title: 'Consumer Protection Circular',
                contentHash: 'abc123def456',
            },
            {
                fee_cap_sme_admin: { field: 'admin_fee_rate', value: 2.5, unit: '%' },
            }
        );

        assert.equal(alerts.length, 1);
        assert.equal(alerts[0].authority, 'SAMA');
        assert.ok(alerts[0].reasoning.includes('OUT OF COMPLIANCE'));
    });

    it('builds reasoning strings for evaluated alerts', () => {
        const reasoning = buildReasoning(
            { type: 'percentageCap', value: 1, unit: '%', context: 'admin fee must not exceed 1%' },
            { field: 'admin_fee_rate', value: 2.5, unit: '%' },
            { pipeline: 'phase-a-rule-engine', authority: 'SAMA', category: 'Financial', ruleIds: ['Circular 402'] },
            { title: 'Test Circular', contentHash: 'abc123' }
        );

        assert.ok(reasoning.includes('SAMA'));
        assert.ok(reasoning.includes('OUT OF COMPLIANCE'));
    });
});
