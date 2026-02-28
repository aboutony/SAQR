// ============================================
// SAQR NLP Interpreter — Instruction Drift Detector
// Compares new circular obligations against stored baseline
// to detect regulatory changes ("instruction drift")
// ============================================

/**
 * @typedef {object} DriftAlert
 * @property {string} alertId
 * @property {string} driftType - 'added' | 'removed' | 'modified' | 'parameter_change'
 * @property {string} authority
 * @property {string} severity - 'critical' | 'high' | 'medium' | 'low'
 * @property {string} title
 * @property {string} description
 * @property {object|null} previousObligation
 * @property {object|null} newObligation
 * @property {object} parameterDiff - Changed parameters
 * @property {string} detectedAt - ISO timestamp
 */

/**
 * Detects instruction drift between a baseline set of obligations
 * and a newly extracted set from an updated circular.
 *
 * @param {import('./obligation-extractor').Obligation[]} baseline - Previous obligations
 * @param {import('./obligation-extractor').Obligation[]} incoming - New obligations
 * @param {string} authority
 * @returns {DriftAlert[]}
 */
function detectDrift(baseline, incoming, authority) {
    const alerts = [];
    let alertIndex = 0;
    const now = new Date().toISOString();

    // Index baseline by normalised text for matching
    const baselineMap = new Map();
    for (const obl of baseline) {
        const key = normaliseText(obl.obligationText);
        baselineMap.set(key, obl);
    }

    const incomingMap = new Map();
    for (const obl of incoming) {
        const key = normaliseText(obl.obligationText);
        incomingMap.set(key, obl);
    }

    // Detect ADDED obligations (in incoming but not baseline)
    for (const [key, obl] of incomingMap) {
        if (!baselineMap.has(key)) {
            // Check if it's a modification of an existing rule (fuzzy match)
            const fuzzyMatch = findFuzzyMatch(obl, baseline);

            if (fuzzyMatch) {
                // Modified obligation — check parameter changes
                const paramDiff = compareParameters(fuzzyMatch.parameters, obl.parameters);
                alertIndex++;
                alerts.push({
                    alertId: `DRIFT-${authority}-${alertIndex.toString().padStart(4, '0')}`,
                    driftType: Object.keys(paramDiff).length > 0 ? 'parameter_change' : 'modified',
                    authority,
                    severity: determineDriftSeverity(obl, paramDiff),
                    title: `Regulation Modified: ${obl.article}`,
                    description: buildModificationDescription(fuzzyMatch, obl, paramDiff),
                    previousObligation: fuzzyMatch,
                    newObligation: obl,
                    parameterDiff: paramDiff,
                    detectedAt: now,
                });
            } else {
                // Entirely new obligation
                alertIndex++;
                alerts.push({
                    alertId: `DRIFT-${authority}-${alertIndex.toString().padStart(4, '0')}`,
                    driftType: 'added',
                    authority,
                    severity: obl.obligationType === 'prohibition' ? 'critical' : 'high',
                    title: `New Regulation Added: ${obl.article}`,
                    description: `New ${obl.obligationType} detected: "${truncate(obl.obligationText, 120)}"`,
                    previousObligation: null,
                    newObligation: obl,
                    parameterDiff: {},
                    detectedAt: now,
                });
            }
        }
    }

    // Detect REMOVED obligations (in baseline but not incoming)
    for (const [key, obl] of baselineMap) {
        if (!incomingMap.has(key)) {
            const fuzzyMatch = findFuzzyMatch(obl, incoming);
            if (!fuzzyMatch) {
                alertIndex++;
                alerts.push({
                    alertId: `DRIFT-${authority}-${alertIndex.toString().padStart(4, '0')}`,
                    driftType: 'removed',
                    authority,
                    severity: 'high',
                    title: `Regulation Removed: ${obl.article}`,
                    description: `Previously active ${obl.obligationType} no longer present: "${truncate(obl.obligationText, 120)}"`,
                    previousObligation: obl,
                    newObligation: null,
                    parameterDiff: {},
                    detectedAt: now,
                });
            }
        }
    }

    return alerts;
}

// -----------------------------------------------
// Fuzzy matching
// -----------------------------------------------

/**
 * Finds a fuzzy match for an obligation in a list.
 * Uses Jaccard similarity on word sets.
 */
function findFuzzyMatch(obligation, candidates) {
    const oblWords = getWordSet(obligation.obligationText);
    let bestMatch = null;
    let bestScore = 0;

    for (const candidate of candidates) {
        if (candidate.obligationType !== obligation.obligationType) continue;

        const candWords = getWordSet(candidate.obligationText);
        const score = jaccardSimilarity(oblWords, candWords);

        if (score > bestScore && score >= 0.5) {
            bestScore = score;
            bestMatch = candidate;
        }
    }

    return bestMatch;
}

function getWordSet(text) {
    return new Set(
        normaliseText(text)
            .split(/\s+/)
            .filter(w => w.length > 2)
    );
}

function jaccardSimilarity(setA, setB) {
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
}

// -----------------------------------------------
// Parameter comparison
// -----------------------------------------------

function compareParameters(oldParams, newParams) {
    const diff = {};
    const allKeys = new Set([...Object.keys(oldParams || {}), ...Object.keys(newParams || {})]);

    for (const key of allKeys) {
        const oldVal = (oldParams || {})[key];
        const newVal = (newParams || {})[key];

        if (oldVal !== newVal) {
            diff[key] = {
                previous: oldVal ?? null,
                current: newVal ?? null,
                change: oldVal && newVal ? ((newVal - oldVal) / oldVal * 100).toFixed(1) + '%' : 'new',
            };
        }
    }

    return diff;
}

// -----------------------------------------------
// Severity classification
// -----------------------------------------------

function determineDriftSeverity(obligation, paramDiff) {
    // Parameter changes in mandatory obligations are critical
    if (Object.keys(paramDiff).length > 0 && obligation.severity === 'mandatory') {
        // Check if it's a financial parameter change
        if (paramDiff.currency || paramDiff.percentage) return 'critical';
        if (paramDiff.fontSize) return 'high';
        return 'high';
    }

    if (obligation.obligationType === 'prohibition') return 'critical';
    if (obligation.obligationType === 'requirement') return 'high';
    return 'medium';
}

// -----------------------------------------------
// Helpers
// -----------------------------------------------

function normaliseText(text) {
    return (text || '')
        .toLowerCase()
        .replace(/[\u064B-\u065F]/g, '') // Remove Arabic diacritics
        .replace(/[^\w\u0600-\u06FF\s]/g, '') // Keep only alphanumeric + Arabic
        .replace(/\s+/g, ' ')
        .trim();
}

function truncate(text, maxLen) {
    return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
}

function buildModificationDescription(previous, current, paramDiff) {
    const parts = [`Obligation in ${current.article} has been modified.`];

    for (const [param, diff] of Object.entries(paramDiff)) {
        if (diff.previous !== null && diff.current !== null) {
            parts.push(`${param}: ${diff.previous} → ${diff.current} (${diff.change})`);
        } else if (diff.previous === null) {
            parts.push(`${param}: NEW parameter value ${diff.current}`);
        } else {
            parts.push(`${param}: ${diff.previous} REMOVED`);
        }
    }

    return parts.join(' | ');
}

module.exports = { detectDrift, findFuzzyMatch, jaccardSimilarity, compareParameters };
