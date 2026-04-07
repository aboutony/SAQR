const { createRuleEngine } = require('../../../shared/rule-engine');
const { assertProviderContract } = require('../../../shared/provider-contract');
const {
    createFinancialCapRuleset,
    createMinimumThresholdRuleset,
    createTimeConstraintRuleset,
} = require('./rules/constraint-rules');

const DEFAULT_CONSTRAINT_RULESETS = [
    createFinancialCapRuleset(),
    createMinimumThresholdRuleset(),
    createTimeConstraintRuleset(),
];

function createKeywordFieldMatcher() {
    return {
        matches(constraint, fieldKey) {
            const context = (constraint.context || '').toLowerCase();
            const keyWords = String(fieldKey || '')
                .toLowerCase()
                .split('_');

            return keyWords.some((word) => word.length > 2 && context.includes(word));
        },
    };
}

function createDefaultPotentialFineCalculator() {
    return {
        calculate(constraint, extraction) {
            const penaltyConstraints = extraction.constraints.filter((item) => item.type === 'penaltyAmount');
            if (penaltyConstraints.length > 0) {
                return penaltyConstraints[0].value;
            }

            const defaults = {
                SAMA: 500000,
                SDAIA: 5000000,
                ZATCA: 250000,
                SFDA: 1000000,
                MOH: 500000,
                MOMAH: 2000000,
                MHRSD: 100000,
            };

            return defaults[extraction.authority] || 500000;
        },
    };
}

function createConstraintEvaluationService({
    rulesets = DEFAULT_CONSTRAINT_RULESETS,
    fieldMatcher = createKeywordFieldMatcher(),
    fineCalculator = createDefaultPotentialFineCalculator(),
} = {}) {
    const ruleEngine = createRuleEngine({
        domain: 'nlp.constraint',
        rulesets,
    });
    const matcher = assertProviderContract('nlp.constraint.fieldMatcher', fieldMatcher, ['matches']);
    const calculator = assertProviderContract('nlp.constraint.fineCalculator', fineCalculator, ['calculate']);

    function evaluateConstraint(constraint, cdcField) {
        const [violation] = ruleEngine.evaluate({ constraint, cdcField });
        return violation || null;
    }

    function calculatePotentialFine(constraint, extraction) {
        return calculator.calculate(constraint, extraction);
    }

    function compareConstraintsToCDC(extraction, entry, cdcValues) {
        const alerts = [];

        for (const constraint of extraction.constraints) {
            for (const [fieldKey, cdcField] of Object.entries(cdcValues || {})) {
                if (!matcher.matches(constraint, fieldKey)) {
                    continue;
                }

                const violation = evaluateConstraint(constraint, cdcField);
                if (!violation) {
                    continue;
                }

                alerts.push({
                    alertId: `CDC-${entry.authority}-${fieldKey}-${Date.now()}`,
                    authority: entry.authority,
                    ruleId: extraction.ruleIds[0] || `${entry.authority}-AUTO`,
                    title: violation.description,
                    reasoning: buildReasoning(constraint, cdcField, extraction, entry),
                    severity: violation.severity,
                    potentialFine: calculatePotentialFine(constraint, extraction),
                    constraint: {
                        type: constraint.type,
                        regulatoryValue: constraint.value,
                        unit: constraint.unit,
                        context: constraint.context,
                    },
                    cdcValue: {
                        field: cdcField.field,
                        currentValue: cdcField.value,
                        unit: cdcField.unit,
                    },
                    hashedLink: createAlertHash(entry.contentHash, cdcField.field, constraint.value),
                    detectedAt: new Date().toISOString(),
                });
            }
        }

        return alerts;
    }

    return {
        evaluateConstraint,
        calculatePotentialFine,
        compareConstraintsToCDC,
    };
}

function createAlertHash(contentHash, field, value) {
    return require('crypto')
        .createHash('sha256')
        .update(`${contentHash}|${field}|${value}`)
        .digest('hex');
}

function buildReasoning(constraint, cdcField, extraction, entry) {
    const lines = [];

    lines.push(`Semantic Extraction Pipeline (${extraction.pipeline})`);
    lines.push(`Source: ${entry.title}`);
    lines.push(`Authority: ${extraction.authority} | Category: ${extraction.category}`);

    if (extraction.ruleIds.length > 0) {
        lines.push(`Rule IDs: ${extraction.ruleIds.join(', ')}`);
    }

    lines.push('');
    lines.push('Constraint vs. Live Data:');
    lines.push(`  Regulation says: ${constraint.type.replace(/([A-Z])/g, ' $1').trim()} = ${constraint.value} ${constraint.unit}`);
    lines.push(`  CDC stream shows: ${cdcField.field} = ${cdcField.value} ${cdcField.unit}`);
    lines.push('  Status: OUT OF COMPLIANCE');
    lines.push('');
    lines.push(`Context: "${constraint.context}"`);
    lines.push(`Evidence Hash: ${entry.contentHash.substring(0, 16)}...`);

    return lines.join('\n');
}

module.exports = {
    DEFAULT_CONSTRAINT_RULESETS,
    buildReasoning,
    createConstraintEvaluationService,
    createDefaultPotentialFineCalculator,
    createKeywordFieldMatcher,
};
