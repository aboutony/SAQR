function evaluateCoolingOffViolation(afterState, now = new Date()) {
    if (!afterState || !afterState.cancellation_requested) {
        return null;
    }

    const endDate = new Date(afterState.end_date);
    if (afterState.cancellation_requested === true && endDate < now && afterState.status === 'active') {
        return {
            violationCode: 'SAMA-CP-003',
            authority: 'SAMA',
            severity: 'critical',
            title: 'Cooling-off period violation: cancellation blocked after expiry',
            description: `Contract "${afterState.contract_id}" - customer requested cancellation but the cooling-off period ended on ${afterState.end_date}. If the bank failed to process the cancellation within the window, this is a violation.`,
            evidence: {
                table: 'cooling_off_periods',
                contract_id: afterState.contract_id,
                customer_id: afterState.customer_id,
                end_date: afterState.end_date,
                cancellation_requested: true,
            },
        };
    }

    return null;
}

const samaCoolingOffRuleset = {
    id: 'sama.cooling_off_periods',
    supports(context) {
        return context.table === 'cooling_off_periods' && context.operation !== 'DELETE';
    },
    evaluate(context) {
        return evaluateCoolingOffViolation(context.afterState, context.now);
    },
};

module.exports = {
    evaluateCoolingOffViolation,
    samaCoolingOffRuleset,
};
