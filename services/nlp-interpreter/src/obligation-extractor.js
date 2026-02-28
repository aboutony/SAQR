// ============================================
// SAQR NLP Interpreter — Obligation Extractor
// Rule-based engine with BERT-compatible interface
// ============================================
//
// Architecture Note: This module uses keyword/pattern extraction
// as Phase A. The `extractObligations()` function signature is
// designed for zero-code swap to Arabic Legal-BERT in Phase B.
// The BERT model will replace the `_ruleBasedExtract()` internals
// while the interface remains identical.
// ============================================

/**
 * @typedef {object} Obligation
 * @property {string} obligationId
 * @property {string} authority - SAMA | SFDA | MOMAH
 * @property {string} article - Reference article/clause
 * @property {string} obligationText - The mandatory requirement
 * @property {string} obligationType - 'prohibition' | 'requirement' | 'threshold' | 'deadline'
 * @property {object} parameters - Extracted parameters (amounts, sizes, dates)
 * @property {string} severity - 'mandatory' | 'recommended' | 'informational'
 * @property {string} sourceSection - Section ID from parser
 * @property {number} confidence - 0.0 - 1.0 extraction confidence
 */

// -----------------------------------------------
// Obligation keyword patterns
// -----------------------------------------------
const OBLIGATION_KEYWORDS = {
    ar: {
        prohibition: [
            'لا يجوز', 'يُحظر', 'يحظر', 'ممنوع', 'لا يسمح', 'لا يحق',
        ],
        requirement: [
            'يجب', 'ينبغي', 'يتعين', 'يلزم', 'ملزم', 'إلزامي', 'يُشترط',
            'يتوجب', 'من الضروري', 'لا بد من',
        ],
        threshold: [
            'الحد الأقصى', 'الحد الأدنى', 'لا يتجاوز', 'لا يقل عن',
            'على الأقل', 'كحد أقصى', 'بحد أدنى',
        ],
        deadline: [
            'خلال', 'في غضون', 'قبل تاريخ', 'لا يتأخر عن', 'الموعد النهائي',
            'فترة', 'أيام عمل',
        ],
    },
    en: {
        prohibition: [
            'shall not', 'must not', 'may not', 'is prohibited', 'is not permitted',
            'is not allowed', 'forbidden',
        ],
        requirement: [
            'shall', 'must', 'is required', 'is mandatory', 'is obligated',
            'are required', 'will ensure', 'will comply',
        ],
        threshold: [
            'minimum', 'maximum', 'at least', 'no more than', 'not exceed',
            'no less than', 'not less than', 'cap of', 'limit of',
        ],
        deadline: [
            'within', 'by', 'no later than', 'before', 'deadline',
            'business days', 'working days', 'calendar days',
        ],
    },
};

// -----------------------------------------------
// Parameter extraction patterns
// -----------------------------------------------
const PARAM_PATTERNS = {
    // Currency amounts (SAR)
    currency: [
        /(\d[\d,]*\.?\d*)\s*(?:ريال|ر\.س|SAR|SR)/gi,
        /(?:SAR|SR)\s*(\d[\d,]*\.?\d*)/gi,
    ],
    // Percentages
    percentage: [
        /(\d+\.?\d*)\s*%/g,
        /(\d+\.?\d*)\s*(?:بالمائة|في المائة)/g,
    ],
    // Font sizes
    fontSize: [
        /(?:خط|font)\s*(?:بحجم|size)?\s*(?:لا يقل عن|minimum|at least)?\s*(\d+)\s*(?:نقطة|pt|point)/gi,
        /(\d+)\s*(?:نقطة|pt|point)\s*(?:على الأقل|minimum|at least)?/gi,
    ],
    // Time periods (days)
    timePeriod: [
        /(\d+)\s*(?:يوم|أيام|days?)/gi,
        /(\d+)\s*(?:يوم عمل|أيام عمل|business days?|working days?)/gi,
    ],
};

/**
 * Extracts obligations from parsed sections.
 * BERT-compatible interface: same input/output as future model.
 *
 * @param {import('./regulatory-parser').ParsedSection[]} sections
 * @param {string} authority - SAMA | SFDA | MOMAH
 * @returns {Obligation[]}
 */
function extractObligations(sections, authority) {
    // Phase A: Rule-based extraction
    // Phase B: Replace internals with BERT inference
    return _ruleBasedExtract(sections, authority);
}

/**
 * Rule-based obligation extraction (Phase A).
 * @private
 */
function _ruleBasedExtract(sections, authority) {
    const obligations = [];
    let oblIndex = 0;

    for (const section of sections) {
        const text = section.body || '';
        if (!text.trim()) continue;

        const lang = section.language || 'ar';
        const keywords = OBLIGATION_KEYWORDS[lang] || OBLIGATION_KEYWORDS.en;

        // Split into sentences
        const sentences = text.split(/[.。؟!\n]+/).filter(s => s.trim().length > 10);

        for (const sentence of sentences) {
            const trimmed = sentence.trim();

            // Check each obligation type
            for (const [obligationType, patterns] of Object.entries(keywords)) {
                for (const keyword of patterns) {
                    if (trimmed.toLowerCase().includes(keyword.toLowerCase())) {
                        oblIndex++;
                        const params = extractParameters(trimmed);

                        obligations.push({
                            obligationId: `OBL-${authority}-${oblIndex.toString().padStart(4, '0')}`,
                            authority,
                            article: section.sectionId,
                            obligationText: trimmed,
                            obligationType,
                            parameters: params,
                            severity: obligationType === 'prohibition' ? 'mandatory' :
                                obligationType === 'requirement' ? 'mandatory' :
                                    obligationType === 'threshold' ? 'mandatory' : 'informational',
                            sourceSection: section.sectionId,
                            confidence: 0.85, // Rule-based confidence (BERT will provide model confidence)
                        });

                        // Break to avoid duplicate matches on same sentence
                        break;
                    }
                }
                // If we already matched this sentence, skip remaining types
                if (obligations.length > 0 && obligations[obligations.length - 1].obligationText === trimmed) {
                    break;
                }
            }
        }
    }

    return obligations;
}

/**
 * Extracts numerical parameters from obligation text.
 * @param {string} text
 * @returns {object}
 */
function extractParameters(text) {
    const params = {};

    for (const [paramType, patterns] of Object.entries(PARAM_PATTERNS)) {
        for (const pattern of patterns) {
            pattern.lastIndex = 0;
            const match = pattern.exec(text);
            if (match) {
                const value = match[1].replace(/,/g, '');
                params[paramType] = parseFloat(value);
                break;
            }
        }
    }

    return params;
}

module.exports = { extractObligations, extractParameters, OBLIGATION_KEYWORDS };
