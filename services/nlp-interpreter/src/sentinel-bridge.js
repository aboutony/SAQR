// ============================================
// SAQR NLP Interpreter — Sentinel Bridge
// Connects Sentinel Scraper output → Semantic
// Extractor → Drift Detection → Shield Alerts
//
// This is the "Drift-Detection Bridge":
// if (detected_constraint.value != current_log_value) {
//   trigger_shield_amber(rule_id);
//   calculate_potential_fine(detected_penalty);
// }
// ============================================

const { semanticExtract } = require('./semantic-extractor');
const { detectDrift } = require('./drift-detector');
const crypto = require('crypto');

// -----------------------------------------------
// Baseline store (in-memory for Phase A)
// Phase B: PostgreSQL shadow.obligation_baseline
// -----------------------------------------------
const baselineStore = new Map(); // authority → obligations[]

// -----------------------------------------------
// Live CDC values (simulated for demo)
// In production: queried from Debezium CDC stream
// -----------------------------------------------
const SIMULATED_CDC_VALUES = {
    'SAMA': {
        'fee_cap_sme_admin': { field: 'admin_fee_rate', value: 2.5, unit: '%' },
        'fee_cap_personal_loan': { field: 'admin_fee_amount', value: 1500, unit: 'SAR' },
        'cooling_off_period': { field: 'cooling_period_days', value: 10, unit: 'days' },
        'disclosure_font_size': { field: 'font_size_pt', value: 11, unit: 'pt' },
        'cash_advance_fee': { field: 'cash_advance_fee', value: 100, unit: 'SAR' },
    },
    'SDAIA': {
        'data_retention_max': { field: 'retention_period_days', value: 365, unit: 'days' },
        'consent_refresh': { field: 'consent_validity_days', value: 730, unit: 'days' },
        'cross_border_transfer': { field: 'transfer_approved', value: 0, unit: 'boolean' },
    },
};

/**
 * @typedef {object} DriftAlert
 * @property {string} alertId
 * @property {string} authority
 * @property {string} ruleId
 * @property {string} title
 * @property {string} reasoning - Full NLP reasoning explanation
 * @property {string} severity
 * @property {number} potentialFine
 * @property {object} constraint - Detected constraint from regulatory text
 * @property {object} cdcValue - Current value in the system
 * @property {string} hashedLink - SHA-256 linking scraped PDF to detection
 * @property {string} detectedAt
 */

/**
 * Process scraped regulatory entries through the Semantic Extractor
 * and compare against CDC data for drift detection.
 *
 * @param {Array<{authority: string, title: string, sourceUrl: string, contentHash: string}>} scrapedEntries
 * @returns {DriftAlert[]}
 */
function processSentinelBatch(scrapedEntries) {
    const alerts = [];

    for (const entry of scrapedEntries) {
        try {
            // Simulate regulatory text from scraper (in production: PDF/HTML parsed text)
            const regulatoryText = generateRegulatoryText(entry);

            // 1. Run Semantic Extraction pipeline
            const extraction = semanticExtract(regulatoryText, {
                authority: entry.authority,
                title: entry.title,
                sourceUrl: entry.sourceUrl,
            });

            // 2. Check for drift against baseline
            const baseline = baselineStore.get(entry.authority) || [];
            const drifts = detectDrift(baseline, extraction.obligations, entry.authority);

            // 3. Compare constraints against live CDC values
            const cdcAlerts = compareConstraintsToCDC(extraction, entry);

            // 4. Update baseline with new obligations
            baselineStore.set(entry.authority, extraction.obligations);

            // 5. Combine drift alerts and CDC mismatches
            alerts.push(...cdcAlerts);

            if (drifts.length > 0) {
                for (const drift of drifts) {
                    alerts.push({
                        alertId: `DRIFT-${entry.authority}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                        authority: entry.authority,
                        ruleId: extraction.ruleIds[0] || drift.alertId,
                        title: drift.title,
                        reasoning: drift.description,
                        severity: drift.severity,
                        potentialFine: 0,
                        constraint: null,
                        cdcValue: null,
                        hashedLink: crypto.createHash('sha256')
                            .update(`${entry.contentHash}|${drift.alertId}`)
                            .digest('hex'),
                        detectedAt: new Date().toISOString(),
                    });
                }
            }

            console.log(`[BRIDGE] ✅ Processed: ${entry.authority} — "${entry.title.substring(0, 60)}" → ${cdcAlerts.length} CDC alerts, ${drifts.length} drift changes`);
        } catch (err) {
            console.error(`[BRIDGE] ❌ Error processing "${entry.title}": ${err.message}`);
        }
    }

    return alerts;
}

/**
 * Compare extracted constraints against live CDC data.
 * This is the core drift detection logic:
 *
 * if (detected_constraint.value != current_log_value) {
 *   trigger_shield_amber(rule_id);
 *   calculate_potential_fine(detected_penalty);
 * }
 *
 * @param {object} extraction - SemanticExtract result
 * @param {object} entry - Scraped entry metadata
 * @returns {DriftAlert[]}
 */
function compareConstraintsToCDC(extraction, entry) {
    const alerts = [];
    const cdcValues = SIMULATED_CDC_VALUES[entry.authority] || {};

    for (const constraint of extraction.constraints) {
        // Find matching CDC field by constraint type
        for (const [fieldKey, cdcField] of Object.entries(cdcValues)) {
            const isMatch = matchConstraintToField(constraint, fieldKey);
            if (!isMatch) continue;

            // THE CORE CHECK: does the CDC value violate the regulatory constraint?
            const violation = evaluateConstraint(constraint, cdcField);
            if (!violation) continue;

            const potentialFine = calculatePotentialFine(constraint, extraction);

            alerts.push({
                alertId: `CDC-${entry.authority}-${fieldKey}-${Date.now()}`,
                authority: entry.authority,
                ruleId: extraction.ruleIds[0] || `${entry.authority}-AUTO`,
                title: `${violation.description}`,
                reasoning: buildReasoning(constraint, cdcField, extraction, entry),
                severity: violation.severity,
                potentialFine,
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
                hashedLink: crypto.createHash('sha256')
                    .update(`${entry.contentHash}|${cdcField.field}|${constraint.value}`)
                    .digest('hex'),
                detectedAt: new Date().toISOString(),
            });
        }
    }

    return alerts;
}

/**
 * Match a constraint to a CDC field by keyword analysis.
 */
function matchConstraintToField(constraint, fieldKey) {
    const context = (constraint.context || '').toLowerCase();
    const key = fieldKey.toLowerCase();

    // Simple heuristic matching
    const keyWords = key.split('_');
    return keyWords.some(w => w.length > 2 && context.includes(w));
}

/**
 * Evaluate whether a CDC value violates a regulatory constraint.
 */
function evaluateConstraint(constraint, cdcField) {
    const regValue = constraint.value;
    const cdcValue = cdcField.value;

    switch (constraint.type) {
        case 'financialCap':
        case 'percentageCap':
            if (cdcValue > regValue) {
                return {
                    severity: cdcValue > regValue * 1.5 ? 'critical' : 'high',
                    description: `Detected ${cdcValue}${constraint.unit} in logs; regulation requires maximum ${regValue}${constraint.unit}`,
                };
            }
            break;

        case 'minimumThreshold':
            if (cdcValue < regValue) {
                return {
                    severity: 'high',
                    description: `Detected ${cdcValue}${constraint.unit} in logs; regulation requires minimum ${regValue}${constraint.unit}`,
                };
            }
            break;

        case 'timeConstraint':
            if (cdcValue > regValue) {
                return {
                    severity: 'medium',
                    description: `Process taking ${cdcValue} days; regulation requires within ${regValue} days`,
                };
            }
            break;

        case 'penaltyAmount':
            // Penalty amounts inform fine calculation, not violations
            return null;
    }

    return null;
}

/**
 * Build a human-readable reasoning string.
 * This appears in the Evidence Vault's "Intelligence Reveal."
 */
function buildReasoning(constraint, cdcField, extraction, entry) {
    const lines = [];

    lines.push(`🔍 Semantic Extraction Pipeline (${extraction.pipeline})`);
    lines.push(`📄 Source: ${entry.title}`);
    lines.push(`🏛️ Authority: ${extraction.authority} — Category: ${extraction.category}`);

    if (extraction.ruleIds.length > 0) {
        lines.push(`📋 Rule IDs: ${extraction.ruleIds.join(', ')}`);
    }

    lines.push('');
    lines.push('⚖️ Constraint vs. Live Data:');
    lines.push(`  Regulation says: ${constraint.type.replace(/([A-Z])/g, ' $1').trim()} = ${constraint.value} ${constraint.unit}`);
    lines.push(`  CDC stream shows: ${cdcField.field} = ${cdcField.value} ${cdcField.unit}`);
    lines.push(`  Status: ❌ OUT OF COMPLIANCE`);

    lines.push('');
    lines.push(`📎 Context: "${constraint.context}"`);
    lines.push(`🔗 Evidence Hash: ${entry.contentHash.substring(0, 16)}…`);

    return lines.join('\n');
}

/**
 * Calculate potential financial exposure from penalty constraints.
 */
function calculatePotentialFine(constraint, extraction) {
    // Look for penalty amounts in the same extraction
    const penaltyConstraints = extraction.constraints.filter(c => c.type === 'penaltyAmount');
    if (penaltyConstraints.length > 0) {
        return penaltyConstraints[0].value;
    }

    // Default escalation based on authority
    const defaults = {
        'SAMA': 500000,
        'SDAIA': 5000000,
        'ZATCA': 250000,
        'SFDA': 1000000,
        'MOH': 500000,
        'MOMAH': 2000000,
        'MHRSD': 100000,
    };

    return defaults[extraction.authority] || 500000;
}

/**
 * Generate simulated regulatory text from a scraped entry.
 * In production, this would be the actual PDF/HTML content.
 */
function generateRegulatoryText(entry) {
    const templates = {
        'SAMA': `Circular No. 402/2026
${entry.title}

Article 1: All licensed financial institutions shall comply with the following provisions:
1. The maximum administrative fee for SME lending products shall not exceed 1% of the loan value, effective 2026-02-01.
2. Consumer disclosures must use font size minimum 14pt for all Arabic text on digital channels.
3. Banks shall process customer cooling-off cancellation requests within 10 business days.
4. Cash advance fees on credit cards shall not exceed SAR 75 per transaction.

Article 2: Penalties
Non-compliance with this circular may result in penalties of up to SAR 500,000 per violation, SAR 2,000,000 for repeated offenses.`,

        'SDAIA': `PDPL Implementation Directive ${entry.title}

Section 1: Personal Data Protection Requirements
1. Organizations must obtain explicit consent before collecting personal data. Consent validity shall not exceed 365 days.
2. Cross-border data transfers are prohibited without SDAIA approval.
3. Data Protection Officers must be registered within 30 business days of appointment.

Section 2: Enforcement
Violations of the Personal Data Protection Law may result in fines up to SAR 5,000,000 and suspension of data processing activities.`,
    };

    return templates[entry.authority] || `${entry.title}\n\nRegulatory text for ${entry.authority} compliance monitoring.`;
}

/**
 * Demo function: process mock sentinel entries and return alerts.
 */
function processSentinelDemo() {
    const mockEntries = [
        {
            authority: 'SAMA',
            title: 'Circular: Maximum Admin Fee Cap for SME Products',
            sourceUrl: 'https://sama.gov.sa/en-US/Circulars/Pages/BankCirculars.aspx',
            contentHash: crypto.createHash('sha256').update('SAMA-demo-sme-fee-2026').digest('hex'),
        },
        {
            authority: 'SDAIA',
            title: 'PDPL Implementation Guidelines for Financial Sector',
            sourceUrl: 'https://sdaia.gov.sa/en/MediaCenter/News/',
            contentHash: crypto.createHash('sha256').update('SDAIA-demo-pdpl-2026').digest('hex'),
        },
    ];

    return processSentinelBatch(mockEntries);
}

module.exports = {
    processSentinelBatch,
    processSentinelDemo,
    compareConstraintsToCDC,
    evaluateConstraint,
    buildReasoning,
    calculatePotentialFine,
    baselineStore,
};
