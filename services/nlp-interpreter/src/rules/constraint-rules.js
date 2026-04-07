function createFinancialCapRuleset() {
    return {
        id: 'constraint.financial_caps',
        supports(context) {
            return ['financialCap', 'percentageCap'].includes(context.constraint?.type);
        },
        evaluate(context) {
            const { constraint, cdcField } = context;
            if (cdcField.value > constraint.value) {
                return {
                    severity: cdcField.value > constraint.value * 1.5 ? 'critical' : 'high',
                    description: `Detected ${cdcField.value}${constraint.unit} in logs; regulation requires maximum ${constraint.value}${constraint.unit}`,
                };
            }

            return null;
        },
    };
}

function createMinimumThresholdRuleset() {
    return {
        id: 'constraint.minimum_thresholds',
        supports(context) {
            return context.constraint?.type === 'minimumThreshold';
        },
        evaluate(context) {
            const { constraint, cdcField } = context;
            if (cdcField.value < constraint.value) {
                return {
                    severity: 'high',
                    description: `Detected ${cdcField.value}${constraint.unit} in logs; regulation requires minimum ${constraint.value}${constraint.unit}`,
                };
            }

            return null;
        },
    };
}

function createTimeConstraintRuleset() {
    return {
        id: 'constraint.time_windows',
        supports(context) {
            return context.constraint?.type === 'timeConstraint';
        },
        evaluate(context) {
            const { constraint, cdcField } = context;
            if (cdcField.value > constraint.value) {
                return {
                    severity: 'medium',
                    description: `Process taking ${cdcField.value} days; regulation requires within ${constraint.value} days`,
                };
            }

            return null;
        },
    };
}

module.exports = {
    createFinancialCapRuleset,
    createMinimumThresholdRuleset,
    createTimeConstraintRuleset,
};
