// ============================================
// SAQR - Compliance Engine
// Detects violations in CDC events against
// SAMA/MOMAH regulatory rules
// ============================================

const { createRuleEngine } = require('../../../shared/rule-engine');
const { samaDisclosureRuleset } = require('./rules/sama-disclosure-rules');
const { samaCoolingOffRuleset } = require('./rules/sama-cooling-off-rules');
const { momahBranchRuleset } = require('./rules/momah-branch-rules');

const CDC_RULESETS = [
    samaDisclosureRuleset,
    samaCoolingOffRuleset,
    momahBranchRuleset,
];

function createComplianceEvaluationService({ rulesets = CDC_RULESETS } = {}) {
    return createRuleEngine({
        domain: 'cdc.compliance',
        rulesets,
    });
}

const defaultComplianceEvaluationService = createComplianceEvaluationService();

/**
 * Routes a CDC event through the appropriate compliance rules
 * based on the source table.
 *
 * @param {string} table - Source table name
 * @param {string} operation - INSERT | UPDATE | DELETE
 * @param {object} afterState - The 'after' state of the row
 * @param {{ now?: Date }} [options]
 * @returns {Array<object>} Array of detected violations (may be empty)
 */
function detectViolations(table, operation, afterState, options = {}) {
    if (operation === 'DELETE') {
        return [];
    }

    return defaultComplianceEvaluationService.evaluate({
        table,
        operation,
        afterState,
        now: options.now || new Date(),
    });
}

module.exports = {
    CDC_RULESETS,
    createComplianceEvaluationService,
    detectViolations,
};
