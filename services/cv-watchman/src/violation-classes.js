// ============================================
// SAQR CV Watchman — MOMAH Violation Classes
// 9 universal categories per 2026 guidelines
// ============================================

/**
 * @typedef {object} ViolationClass
 * @property {string} id - YOLO class index
 * @property {string} code - MOMAH violation code
 * @property {string} nameEn - English name
 * @property {string} nameAr - Arabic name
 * @property {string} category - signage | visual | structural
 * @property {string} descriptionEn
 * @property {string} descriptionAr
 * @property {string} severity - critical | high | medium
 * @property {number} minPenaltySar
 * @property {number} maxPenaltySar
 * @property {number} confidenceThreshold - Min confidence to flag
 */

const VIOLATION_CLASSES = [
    // --- SIGNAGE INTEGRITY ---
    {
        id: 0,
        code: 'MOMAH-CV-001',
        nameEn: 'Burnt-Out Signage',
        nameAr: 'لوحة إعلانية محترقة',
        category: 'signage',
        descriptionEn: 'One or more LED letters/elements non-functional on commercial signage',
        descriptionAr: 'حرف أو أكثر من عناصر LED غير عاملة في اللوحة الإعلانية التجارية',
        severity: 'high',
        minPenaltySar: 10000,
        maxPenaltySar: 100000,
        confidenceThreshold: 0.65,
    },
    {
        id: 1,
        code: 'MOMAH-CV-002',
        nameEn: 'Flickering Signage',
        nameAr: 'لوحة إعلانية وامضة',
        category: 'signage',
        descriptionEn: 'Intermittent or flickering commercial signage detected',
        descriptionAr: 'تم الكشف عن لوحة إعلانية تجارية متقطعة أو وامضة',
        severity: 'medium',
        minPenaltySar: 5000,
        maxPenaltySar: 50000,
        confidenceThreshold: 0.60,
    },
    {
        id: 2,
        code: 'MOMAH-CV-003',
        nameEn: 'Damaged Storefront',
        nameAr: 'واجهة متجر متضررة',
        category: 'signage',
        descriptionEn: 'Physical damage to storefront signage, fascia, or canopy',
        descriptionAr: 'أضرار مادية في لوحة واجهة المتجر أو المظلة',
        severity: 'high',
        minPenaltySar: 25000,
        maxPenaltySar: 250000,
        confidenceThreshold: 0.70,
    },

    // --- VISUAL DISTORTION ---
    {
        id: 3,
        code: 'MOMAH-CV-004',
        nameEn: 'Sidewalk Obstruction',
        nameAr: 'عرقلة الرصيف',
        category: 'visual',
        descriptionEn: 'Unauthorized items placed on public sidewalk blocking pedestrian flow',
        descriptionAr: 'عناصر غير مرخصة موضوعة على الرصيف العام تعيق حركة المشاة',
        severity: 'medium',
        minPenaltySar: 5000,
        maxPenaltySar: 100000,
        confidenceThreshold: 0.60,
    },
    {
        id: 4,
        code: 'MOMAH-CV-005',
        nameEn: 'Facade Crack/Damage',
        nameAr: 'تشقق/تلف الواجهة',
        category: 'visual',
        descriptionEn: 'Visible cracks, peeling paint, or structural damage to building facade',
        descriptionAr: 'تشققات مرئية أو تقشر الطلاء أو أضرار هيكلية في واجهة المبنى',
        severity: 'high',
        minPenaltySar: 20000,
        maxPenaltySar: 500000,
        confidenceThreshold: 0.65,
    },
    {
        id: 5,
        code: 'MOMAH-CV-006',
        nameEn: 'Unauthorized Banner/Poster',
        nameAr: 'لافتة/ملصق غير مرخص',
        category: 'visual',
        descriptionEn: 'Non-permitted banners, posters, or advertisements on building exterior',
        descriptionAr: 'لافتات أو ملصقات أو إعلانات غير مرخصة على واجهة المبنى',
        severity: 'medium',
        minPenaltySar: 5000,
        maxPenaltySar: 75000,
        confidenceThreshold: 0.55,
    },

    // --- STRUCTURAL AUDITING ---
    {
        id: 6,
        code: 'MOMAH-CV-007',
        nameEn: 'Unauthorized Partitioning',
        nameAr: 'تقسيم غير مرخص',
        category: 'structural',
        descriptionEn: 'Interior or exterior partitioning deviating from approved municipal permit layout',
        descriptionAr: 'تقسيم داخلي أو خارجي يخالف مخطط الرخصة البلدية المعتمدة',
        severity: 'critical',
        minPenaltySar: 50000,
        maxPenaltySar: 2000000,
        confidenceThreshold: 0.75,
    },
    {
        id: 7,
        code: 'MOMAH-CV-008',
        nameEn: 'Unauthorized Extension',
        nameAr: 'توسعة غير مرخصة',
        category: 'structural',
        descriptionEn: 'Structural extension or addition not in approved building permit',
        descriptionAr: 'توسعة أو إضافة هيكلية غير موجودة في رخصة البناء المعتمدة',
        severity: 'critical',
        minPenaltySar: 100000,
        maxPenaltySar: 5000000,
        confidenceThreshold: 0.80,
    },
    {
        id: 8,
        code: 'MOMAH-CV-009',
        nameEn: 'Safety Hazard Detected',
        nameAr: 'خطر سلامة مكتشف',
        category: 'structural',
        descriptionEn: 'Visible safety hazards: exposed wiring, missing railings, blocked emergency exits',
        descriptionAr: 'مخاطر سلامة مرئية: أسلاك مكشوفة، حواجز مفقودة، مخارج طوارئ مسدودة',
        severity: 'critical',
        minPenaltySar: 50000,
        maxPenaltySar: 1000000,
        confidenceThreshold: 0.70,
    },
];

/**
 * Get a violation class by YOLO index.
 * @param {number} classId
 * @returns {ViolationClass|undefined}
 */
function getClassById(classId) {
    return VIOLATION_CLASSES.find(c => c.id === classId);
}

/**
 * Get a violation class by MOMAH code.
 * @param {string} code
 * @returns {ViolationClass|undefined}
 */
function getClassByCode(code) {
    return VIOLATION_CLASSES.find(c => c.code === code);
}

/**
 * Get all classes in a category.
 * @param {'signage'|'visual'|'structural'} category
 */
function getClassesByCategory(category) {
    return VIOLATION_CLASSES.filter(c => c.category === category);
}

module.exports = {
    VIOLATION_CLASSES,
    getClassById,
    getClassByCode,
    getClassesByCategory,
};
