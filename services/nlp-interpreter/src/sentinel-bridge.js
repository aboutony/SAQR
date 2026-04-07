// ============================================
// SAQR NLP Interpreter - Sentinel Bridge
// Connects Sentinel scraper output -> semantic
// extraction -> drift detection -> shield alerts
// ============================================

const crypto = require('crypto');
const { semanticExtract } = require('./semantic-extractor');
const { detectDrift } = require('./drift-detector');
const {
    buildReasoning,
    createConstraintEvaluationService,
    createKeywordFieldMatcher,
} = require('./constraint-engine');

// -----------------------------------------------
// Baseline store (in-memory for Phase A)
// Phase B: PostgreSQL shadow.obligation_baseline
// -----------------------------------------------
const baselineStore = new Map();

// -----------------------------------------------
// Live CDC values (simulated for demo)
// In production: queried from Debezium CDC stream
// -----------------------------------------------
const SIMULATED_CDC_VALUES = {
    SAMA: {
        fee_cap_sme_admin: { field: 'admin_fee_rate', value: 2.5, unit: '%' },
        fee_cap_personal_loan: { field: 'admin_fee_amount', value: 1500, unit: 'SAR' },
        cooling_off_period: { field: 'cooling_period_days', value: 10, unit: 'days' },
        disclosure_font_size: { field: 'font_size_pt', value: 11, unit: 'pt' },
        cash_advance_fee: { field: 'cash_advance_fee', value: 100, unit: 'SAR' },
    },
    SDAIA: {
        data_retention_max: { field: 'retention_period_days', value: 365, unit: 'days' },
        consent_refresh: { field: 'consent_validity_days', value: 730, unit: 'days' },
        cross_border_transfer: { field: 'transfer_approved', value: 0, unit: 'boolean' },
    },
};

const constraintEvaluationService = createConstraintEvaluationService();
const keywordFieldMatcher = createKeywordFieldMatcher();

/**
 * Process scraped regulatory entries through the Semantic Extractor
 * and compare against CDC data for drift detection.
 *
 * @param {Array<{authority: string, title: string, sourceUrl: string, contentHash: string}>} scrapedEntries
 * @param {{ logger?: object }} [options]
 * @returns {Array<object>}
 */
function processSentinelBatch(scrapedEntries, options = {}) {
    const alerts = [];
    const logger = options.logger || null;

    for (const entry of scrapedEntries) {
        try {
            const regulatoryText = generateRegulatoryText(entry);

            const extraction = semanticExtract(regulatoryText, {
                authority: entry.authority,
                title: entry.title,
                sourceUrl: entry.sourceUrl,
            });

            const baseline = baselineStore.get(entry.authority) || [];
            const drifts = detectDrift(baseline, extraction.obligations, entry.authority);
            const cdcAlerts = compareConstraintsToCDC(extraction, entry);

            baselineStore.set(entry.authority, extraction.obligations);
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

            logger?.info('nlp.sentinel_entry_processed', {
                authority: entry.authority,
                titlePreview: entry.title.substring(0, 60),
                cdcAlertCount: cdcAlerts.length,
                driftCount: drifts.length,
            });
        } catch (err) {
            logger?.error('nlp.sentinel_entry_failed', err, {
                authority: entry.authority,
                title: entry.title,
            });
        }
    }

    return alerts;
}

/**
 * Compare extracted constraints against live CDC data.
 *
 * @param {object} extraction - SemanticExtract result
 * @param {object} entry - Scraped entry metadata
 * @returns {Array<object>}
 */
function compareConstraintsToCDC(extraction, entry) {
    return constraintEvaluationService.compareConstraintsToCDC(
        extraction,
        entry,
        SIMULATED_CDC_VALUES[entry.authority] || {}
    );
}

/**
 * Match a constraint to a CDC field by keyword analysis.
 */
function matchConstraintToField(constraint, fieldKey) {
    return keywordFieldMatcher.matches(constraint, fieldKey);
}

/**
 * Evaluate whether a CDC value violates a regulatory constraint.
 */
function evaluateConstraint(constraint, cdcField) {
    return constraintEvaluationService.evaluateConstraint(constraint, cdcField);
}

/**
 * Calculate potential financial exposure from penalty constraints.
 */
function calculatePotentialFine(constraint, extraction) {
    return constraintEvaluationService.calculatePotentialFine(constraint, extraction);
}

/**
 * Generate simulated regulatory text from a scraped entry.
 * In production, this would be actual PDF/HTML content.
 */
function generateRegulatoryText(entry) {
    const templates = {
        SAMA: `Circular No. 402/2026
${entry.title}

Article 1: All licensed financial institutions shall comply with the following provisions:
1. The maximum administrative fee for SME lending products shall not exceed 1% of the loan value, effective 2026-02-01.
2. Consumer disclosures must use font size minimum 14pt for all Arabic text on digital channels.
3. Banks shall process customer cooling-off cancellation requests within 10 business days.
4. Cash advance fees on credit cards shall not exceed SAR 75 per transaction.

Article 2: Penalties
Non-compliance with this circular may result in penalties of up to SAR 500,000 per violation, SAR 2,000,000 for repeated offenses.`,

        SDAIA: `PDPL Implementation Directive ${entry.title}

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
 *
 * @param {{ logger?: object }} [options]
 * @returns {Array<object>}
 */
function processSentinelDemo(options = {}) {
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

    return processSentinelBatch(mockEntries, options);
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
