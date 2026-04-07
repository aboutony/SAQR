function evaluateBranchComplianceViolations(afterState, now = new Date()) {
    if (!afterState) {
        return [];
    }

    const violations = [];

    if (afterState.signage_status === 'non_compliant') {
        violations.push({
            violationCode: 'MOMAH-BR-001',
            authority: 'MOMAH',
            severity: 'high',
            title: `Non-compliant signage at ${afterState.branch_name}`,
            description: `Branch "${afterState.branch_code}" in ${afterState.municipality} has non-compliant signage per 2026 MOMAH guidelines.`,
            evidence: {
                table: 'branch_compliance',
                branch_code: afterState.branch_code,
                field: 'signage_status',
                value: 'non_compliant',
            },
        });
    }

    if (afterState.lighting_status === 'non_compliant') {
        violations.push({
            violationCode: 'MOMAH-BR-002',
            authority: 'MOMAH',
            severity: 'medium',
            title: `Non-compliant lighting at ${afterState.branch_name}`,
            description: `Branch "${afterState.branch_code}" in ${afterState.municipality} has non-compliant lighting per 2026 MOMAH guidelines.`,
            evidence: {
                table: 'branch_compliance',
                branch_code: afterState.branch_code,
                field: 'lighting_status',
                value: 'non_compliant',
            },
        });
    }

    if (afterState.license_expiry) {
        const expiry = new Date(afterState.license_expiry);
        if (expiry < now) {
            violations.push({
                violationCode: 'MOMAH-BR-003',
                authority: 'MOMAH',
                severity: 'critical',
                title: `Expired commercial license at ${afterState.branch_name}`,
                description: `Branch "${afterState.branch_code}" in ${afterState.municipality} - commercial license expired on ${afterState.license_expiry}. Maximum penalty: SAR 2,000,000.`,
                evidence: {
                    table: 'branch_compliance',
                    branch_code: afterState.branch_code,
                    field: 'license_expiry',
                    value: afterState.license_expiry,
                },
            });
        }
    }

    return violations;
}

const momahBranchRuleset = {
    id: 'momah.branch_compliance',
    supports(context) {
        return context.table === 'branch_compliance' && context.operation !== 'DELETE';
    },
    evaluate(context) {
        return evaluateBranchComplianceViolations(context.afterState, context.now);
    },
};

module.exports = {
    evaluateBranchComplianceViolations,
    momahBranchRuleset,
};
