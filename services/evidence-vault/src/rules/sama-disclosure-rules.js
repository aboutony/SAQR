function evaluateFontSizeViolation(afterState) {
    if (!afterState || afterState.font_size_pt === undefined) {
        return null;
    }

    const fontSize = parseInt(afterState.font_size_pt, 10);
    if (fontSize >= 14) {
        return null;
    }

    return {
        violationCode: 'SAMA-CP-001',
        authority: 'SAMA',
        severity: 'high',
        title: `Disclosure font size violation: ${fontSize}pt (minimum 14pt)`,
        description: `Product "${afterState.product_name || afterState.product_id}" uses ${fontSize}pt font for consumer disclosure. SAMA Consumer Protection Principles (2026) mandate a minimum of 14pt for all consumer-facing disclosures.`,
        evidence: {
            table: 'consumer_disclosures',
            field: 'font_size_pt',
            actual_value: fontSize,
            required_value: 14,
            product_id: afterState.product_id,
            channel: afterState.channel,
        },
    };
}

const samaDisclosureRuleset = {
    id: 'sama.consumer_disclosures',
    supports(context) {
        return context.table === 'consumer_disclosures' && context.operation !== 'DELETE';
    },
    evaluate(context) {
        return evaluateFontSizeViolation(context.afterState);
    },
};

module.exports = {
    evaluateFontSizeViolation,
    samaDisclosureRuleset,
};
