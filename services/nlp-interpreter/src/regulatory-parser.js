// ============================================
// SAQR NLP Interpreter — Regulatory Document Parser
// Extracts structured text from SAMA/SFDA circulars
// ============================================

/**
 * @typedef {object} ParsedSection
 * @property {string} sectionId - e.g. 'ART-3' or 'CL-3.2'
 * @property {string} title - Section title
 * @property {string} body - Section text content
 * @property {string} language - 'ar' | 'en'
 * @property {number} depth - Nesting depth (0=article, 1=clause, 2=sub-clause)
 */

/**
 * @typedef {object} ParsedCircular
 * @property {string} documentId - Unique identifier
 * @property {string} authority - 'SAMA' | 'SFDA' | 'MOMAH'
 * @property {string} title - Circular title
 * @property {string} referenceNumber - Official reference number
 * @property {string} issueDate - ISO date string
 * @property {string} language - Primary language
 * @property {ParsedSection[]} sections - Extracted sections
 * @property {string} rawText - Full raw text
 */

// -----------------------------------------------
// Arabic article/clause patterns
// -----------------------------------------------
const ARTICLE_PATTERNS = {
    ar: [
        /(?:^|\n)\s*(?:المادة|البند)\s*[:\s]*(\d+[\u0660-\u0669]*)/gm,     // المادة 3 or البند 3
        /(?:^|\n)\s*(?:أولاً|ثانياً|ثالثاً|رابعاً|خامساً|سادساً|سابعاً|ثامناً|تاسعاً|عاشراً)/gm,
        /(?:^|\n)\s*\d+[\.\-\)]\s+/gm,                                       // 1. or 1- or 1)
    ],
    en: [
        /(?:^|\n)\s*Article\s+(\d+)/gim,
        /(?:^|\n)\s*Section\s+(\d+)/gim,
        /(?:^|\n)\s*Clause\s+(\d+[\.\d]*)/gim,
        /(?:^|\n)\s*\d+[\.\-\)]\s+/gm,
    ],
};

/**
 * Detects the primary language of text.
 * @param {string} text
 * @returns {'ar' | 'en'}
 */
function detectLanguage(text) {
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
    return arabicChars > latinChars ? 'ar' : 'en';
}

/**
 * Splits circular text into structured sections.
 * @param {string} text - Full circular text
 * @param {string} language - 'ar' | 'en'
 * @returns {ParsedSection[]}
 */
function splitIntoSections(text, language) {
    const patterns = ARTICLE_PATTERNS[language] || ARTICLE_PATTERNS.en;
    const sections = [];
    const lines = text.split('\n');

    let currentSection = null;
    let sectionIndex = 0;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let isHeader = false;
        for (const pattern of patterns) {
            pattern.lastIndex = 0;
            if (pattern.test(trimmed)) {
                isHeader = true;
                break;
            }
        }

        if (isHeader) {
            if (currentSection) {
                sections.push(currentSection);
            }
            sectionIndex++;
            currentSection = {
                sectionId: `SEC-${sectionIndex}`,
                title: trimmed.substring(0, 100),
                body: '',
                language,
                depth: trimmed.match(/^\s*\d+\.\d+/) ? 1 : 0,
            };
        } else if (currentSection) {
            currentSection.body += (currentSection.body ? '\n' : '') + trimmed;
        } else {
            // Pre-amble text before first section
            currentSection = {
                sectionId: 'SEC-0',
                title: language === 'ar' ? 'مقدمة' : 'Preamble',
                body: trimmed,
                language,
                depth: 0,
            };
        }
    }

    if (currentSection) {
        sections.push(currentSection);
    }

    return sections;
}

/**
 * Parses a regulatory circular from raw text.
 *
 * @param {string} rawText - Full text of the circular
 * @param {object} metadata - { authority, title, referenceNumber, issueDate }
 * @returns {ParsedCircular}
 */
function parseCircular(rawText, metadata = {}) {
    const language = detectLanguage(rawText);
    const sections = splitIntoSections(rawText, language);

    return {
        documentId: `DOC-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        authority: metadata.authority || 'UNKNOWN',
        title: metadata.title || sections[0]?.title || 'Untitled Circular',
        referenceNumber: metadata.referenceNumber || '',
        issueDate: metadata.issueDate || new Date().toISOString().split('T')[0],
        language,
        sections,
        rawText,
    };
}

module.exports = { parseCircular, splitIntoSections, detectLanguage };
