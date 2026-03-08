// ============================================
// SAQR NLP Interpreter — Semantic Extractor
// Transformers-ready pipeline for NER, Constraint
// Extraction, and Action Mapping on regulatory text.
//
// Architecture: Legal-BERT interface with Phase A
// rule-based engine. Zero-code swap to Arabic
// Legal-BERT in Phase B.
// ============================================

const crypto = require('crypto');
const { parseCircular } = require('./regulatory-parser');
const { extractObligations, extractParameters } = require('./obligation-extractor');

// -----------------------------------------------
// NER: Named Entity Recognition
// Extracts Authority, Rule ID, and Effective Date
// -----------------------------------------------

const AUTHORITY_MAP = {
    'SAMA': { fullName: 'Saudi Central Bank', category: 'Financial' },
    'SDAIA': { fullName: 'Saudi Data & AI Authority', category: 'Privacy' },
    'ZATCA': { fullName: 'Zakat, Tax & Customs Authority', category: 'Financial' },
    'SFDA': { fullName: 'Saudi Food & Drug Authority', category: 'Operational' },
    'MOH': { fullName: 'Ministry of Health', category: 'Operational' },
    'MOMAH': { fullName: 'Ministry of Municipal & Rural Affairs', category: 'Operational' },
    'MHRSD': { fullName: 'Ministry of Human Resources', category: 'Operational' },
};

const RULE_ID_PATTERNS = [
    /(?:Circular|تعميم|Resolution|Decision|Directive)\s*(?:No\.?\s*)?(\d{1,3}(?:[\/\-]\d{1,4})?)/gi,
    /(?:SAMA|SDAIA|ZATCA|SFDA|MOH|MOMAH|MHRSD)[-\/](?:CP|DP|TX|HC|BR|HR)-(\d{3,4})/gi,
    /(?:Article|المادة|Section|البند)\s+([\d\.]+)/gi,
];

const DATE_PATTERNS = [
    /(?:effective|فعّال|يسري)\s*(?:from|بتاريخ|اعتبارا من)?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/gi,
    /(\d{4}-\d{2}-\d{2})/g,
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/gi,
    /(\d{1,2}\s+(?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+\d{4})/gi,
];

// -----------------------------------------------
// Constraint Extraction
// Identifies financial, privacy, operational values
// -----------------------------------------------

const CONSTRAINT_PATTERNS = {
    financialCap: [
        /(?:maximum|cap|limit|الحد الأقصى|لا يتجاوز)\s*(?:of|بقيمة)?\s*(?:SAR|ريال)\s*([\d,]+(?:\.\d+)?)/gi,
        /(?:SAR|ريال)\s*([\d,]+(?:\.\d+)?)\s*(?:cap|maximum|limit|كحد أقصى)/gi,
    ],
    percentageCap: [
        /(?:maximum|cap|limit|not exceed|لا يتجاوز|الحد الأقصى)\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*%/gi,
        /(\d+(?:\.\d+)?)\s*%\s*(?:maximum|cap|limit|كحد أقصى)/gi,
    ],
    minimumThreshold: [
        /(?:minimum|at least|not less than|no less than|لا يقل عن|على الأقل)\s*(?:of)?\s*(\d+(?:\.\d+)?)/gi,
    ],
    timeConstraint: [
        /(?:within|خلال|في غضون)\s*(\d+)\s*(?:business|working|عمل)?\s*(?:days|أيام|يوم)/gi,
        /(\d+)\s*(?:calendar days|أيام تقويمية)/gi,
    ],
    penaltyAmount: [
        /(?:penalty|fine|غرامة|عقوبة)\s*(?:of|up to|بقيمة|تصل إلى)?\s*(?:SAR|ريال)\s*([\d,]+(?:\.\d+)?)/gi,
        /(?:SAR|ريال)\s*([\d,]+(?:\.\d+)?)\s*(?:penalty|fine|غرامة)/gi,
    ],
};

// -----------------------------------------------
// Action Mapping Categories
// -----------------------------------------------
const ACTION_CATEGORIES = {
    Financial: ['fee', 'cap', 'charge', 'interest', 'rate', 'admin', 'commission', 'penalty', 'fine',
        'رسوم', 'عمولة', 'فائدة', 'غرامة', 'رسم إداري'],
    Privacy: ['data', 'personal', 'consent', 'privacy', 'PDPL', 'transfer', 'DPO', 'breach',
        'بيانات', 'شخصية', 'موافقة', 'خصوصية', 'حماية البيانات'],
    Operational: ['signage', 'license', 'hygiene', 'safety', 'expiry', 'storage', 'temperature', 'PPE',
        'لوحة', 'رخصة', 'نظافة', 'سلامة', 'صلاحية', 'تخزين'],
};

/**
 * Perform Named Entity Recognition on regulatory text.
 *
 * @param {string} text — raw circular/rule text
 * @param {string} knownAuthority — if already known from scraper
 * @returns {{ authority: string, ruleIds: string[], effectiveDates: string[], category: string }}
 */
function extractEntities(text, knownAuthority) {
    // Authority detection
    let authority = knownAuthority || 'UNKNOWN';
    if (!knownAuthority) {
        for (const code of Object.keys(AUTHORITY_MAP)) {
            if (text.toUpperCase().includes(code)) {
                authority = code;
                break;
            }
        }
    }

    // Rule ID extraction
    const ruleIds = [];
    for (const pattern of RULE_ID_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            ruleIds.push(match[0].trim());
        }
    }

    // Effective date extraction
    const effectiveDates = [];
    for (const pattern of DATE_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            effectiveDates.push(match[1] || match[0]);
        }
    }

    // Action category classification
    const textLower = text.toLowerCase();
    let category = AUTHORITY_MAP[authority]?.category || 'Operational';
    let maxScore = 0;
    for (const [cat, keywords] of Object.entries(ACTION_CATEGORIES)) {
        const score = keywords.filter(k => textLower.includes(k.toLowerCase())).length;
        if (score > maxScore) {
            maxScore = score;
            category = cat;
        }
    }

    return { authority, ruleIds: [...new Set(ruleIds)], effectiveDates: [...new Set(effectiveDates)], category };
}

/**
 * Extract enforceable constraints from regulatory text.
 *
 * @param {string} text
 * @returns {Array<{ type: string, value: number, unit: string, context: string }>}
 */
function extractConstraints(text) {
    const constraints = [];

    for (const [type, patterns] of Object.entries(CONSTRAINT_PATTERNS)) {
        for (const pattern of patterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const rawVal = (match[1] || '').replace(/,/g, '');
                const value = parseFloat(rawVal);
                if (isNaN(value)) continue;

                const unit = type.includes('percentage') ? '%'
                    : type.includes('time') ? 'days'
                        : 'SAR';

                // Get surrounding context (± 80 chars)
                const start = Math.max(0, match.index - 80);
                const end = Math.min(text.length, match.index + match[0].length + 80);
                const context = text.substring(start, end).replace(/\n/g, ' ').trim();

                constraints.push({ type, value, unit, context });
            }
        }
    }

    return constraints;
}

/**
 * Full semantic extraction pipeline.
 * Combines NER, Obligation Extraction, and Constraint mapping.
 *
 * Phase A: Rule-based (current)
 * Phase B: Arabic Legal-BERT transformer (future drop-in)
 *
 * @param {string} rawText — full regulatory circular text
 * @param {{ authority?: string, title?: string, sourceUrl?: string }} metadata
 * @returns {SemanticResult}
 */
function semanticExtract(rawText, metadata = {}) {
    // 1. NER — Named entities
    const entities = extractEntities(rawText, metadata.authority);

    // 2. Parse into structured sections
    const parsed = parseCircular(rawText, {
        authority: entities.authority,
        title: metadata.title,
        referenceNumber: entities.ruleIds[0] || '',
        issueDate: entities.effectiveDates[0] || new Date().toISOString().split('T')[0],
    });

    // 3. Obligation extraction (BERT-compatible interface)
    const obligations = extractObligations(parsed.sections, entities.authority);

    // 4. Constraint extraction
    const constraints = extractConstraints(rawText);

    // 5. Content hash for deduplication
    const contentHash = crypto.createHash('sha256')
        .update(`${entities.authority}|${metadata.title || ''}|${rawText.substring(0, 500)}`)
        .digest('hex');

    return {
        documentId: parsed.documentId,
        authority: entities.authority,
        category: entities.category,
        title: metadata.title || parsed.title,
        sourceUrl: metadata.sourceUrl || '',
        ruleIds: entities.ruleIds,
        effectiveDates: entities.effectiveDates,
        language: parsed.language,
        obligations,
        constraints,
        contentHash,
        extractedAt: new Date().toISOString(),
        confidence: obligations.length > 0 ? 0.85 : 0.60,
        pipeline: 'phase-a-rule-engine', // Will become 'phase-b-legal-bert' after model swap
    };
}

module.exports = {
    semanticExtract,
    extractEntities,
    extractConstraints,
    AUTHORITY_MAP,
    ACTION_CATEGORIES,
};
