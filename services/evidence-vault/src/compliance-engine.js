// ============================================
// SAQR — Compliance Engine
// Detects violations in CDC events against
// SAMA/MOMAH regulatory rules
// ============================================

/**
 * @typedef {object} Violation
 * @property {string} violationCode - Penalty schedule code
 * @property {string} authority - SAMA | MOMAH | SFDA
 * @property {string} severity - critical | high | medium | low
 * @property {string} title - Human-readable violation title
 * @property {string} description - Detailed description
 * @property {object} evidence - The triggering data
 */

// -----------------------------------------------
// SAMA Rules
// -----------------------------------------------

/**
 * SAMA-CP-001: Consumer disclosures must use font ≥ 14pt.
 */
function checkFontSizeCompliance(afterState) {
    if (!afterState || afterState.font_size_pt === undefined) return null;

    const fontSize = parseInt(afterState.font_size_pt, 10);
    if (fontSize < 14) {
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
    return null;
}

/**
 * SAMA-CP-003: Cooling-off period must be respected.
 * Detects if cancellation was requested but period has passed.
 */
function checkCoolingOffPeriod(afterState) {
    if (!afterState || !afterState.cancellation_requested) return null;

    const endDate = new Date(afterState.end_date);
    const now = new Date();

    if (afterState.cancellation_requested === true && endDate < now && afterState.status === 'active') {
        return {
            violationCode: 'SAMA-CP-003',
            authority: 'SAMA',
            severity: 'critical',
            title: `Cooling-off period violation: cancellation blocked after expiry`,
            description: `Contract "${afterState.contract_id}" — customer requested cancellation but the cooling-off period ended on ${afterState.end_date}. If the bank failed to process the cancellation within the window, this is a violation.`,
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

// -----------------------------------------------
// MOMAH Rules
// -----------------------------------------------

/**
 * MOMAH-BR-001 / 002: Branch signage and lighting compliance.
 */
function checkBranchCompliance(afterState) {
    if (!afterState) return null;

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

    // MOMAH-BR-003: Expired license
    if (afterState.license_expiry) {
        const expiry = new Date(afterState.license_expiry);
        const now = new Date();
        if (expiry < now) {
            violations.push({
                violationCode: 'MOMAH-BR-003',
                authority: 'MOMAH',
                severity: 'critical',
                title: `Expired commercial license at ${afterState.branch_name}`,
                description: `Branch "${afterState.branch_code}" in ${afterState.municipality} — commercial license expired on ${afterState.license_expiry}. Maximum penalty: SAR 2,000,000.`,
                evidence: {
                    table: 'branch_compliance',
                    branch_code: afterState.branch_code,
                    field: 'license_expiry',
                    value: afterState.license_expiry,
                },
            });
        }
    }

    return violations.length > 0 ? violations : null;
}

// -----------------------------------------------
// Rule Router
// -----------------------------------------------

/**
 * Routes a CDC event through the appropriate compliance rules
 * based on the source table.
 *
 * @param {string} table - Source table name
 * @param {string} operation - INSERT | UPDATE | DELETE
 * @param {object} afterState - The 'after' state of the row
 * @returns {Violation[]} Array of detected violations (may be empty)
 */
function detectViolations(table, operation, afterState) {
    if (operation === 'DELETE') return []; // deletions don't create new violations

    const violations = [];

    switch (table) {
        case 'consumer_disclosures': {
            const v = checkFontSizeCompliance(afterState);
            if (v) violations.push(v);
            break;
        }
        case 'cooling_off_periods': {
            const v = checkCoolingOffPeriod(afterState);
            if (v) violations.push(v);
            break;
        }
        case 'branch_compliance': {
            const v = checkBranchCompliance(afterState);
            if (v) violations.push(...v);
            break;
        }
        case 'fee_schedule': {
            // Fee cap checks would go here (requires reference data lookup)
            break;
        }
    }

    return violations;
}

module.exports = { detectViolations };
