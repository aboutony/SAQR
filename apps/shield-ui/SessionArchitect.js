// ============================================
// SAQR — SessionArchitect
// Client-Side Multi-Tenant Session Engine
// Hard-Silo Isolation for Industry / Market / Language
// ============================================

const SessionArchitect = (() => {
    'use strict';

    const SILO_KEY = 'saqr-gateway-session';
    const VERSION = '1.0.0';

    // -----------------------------------------------
    // Industry → Schema Mapping
    // -----------------------------------------------
    const INDUSTRY_SCHEMA_MAP = {
        BFSI: { schema: 'banking_schema', label: 'Banking & Financial Services', label_ar: 'الخدمات المصرفية والمالية', demoSector: 'banking', authorities: ['SAMA', 'SDAIA', 'ZATCA'] },
        Healthcare: { schema: 'healthcare_schema', label: 'Healthcare & Life Sciences', label_ar: 'الرعاية الصحية وعلوم الحياة', demoSector: 'healthcare', authorities: ['SFDA', 'MOH', 'SDAIA'] },
        'F&B': { schema: 'fnb_schema', label: 'Food & Beverage / Retail', label_ar: 'المطاعم والتجزئة', demoSector: 'fnb', authorities: ['MOMAH', 'SFDA', 'ZATCA'] },
        Hospitality: { schema: 'hospitality_schema', label: 'Hospitality & Tourism', label_ar: 'الضيافة والسياحة', demoSector: 'hospitality', authorities: ['MOMAH', 'MOT', 'ZATCA'] },
        Education: { schema: 'education_schema', label: 'Education & Training', label_ar: 'التعليم والتدريب', demoSector: 'education', authorities: ['MOE', 'SDAIA', 'MHRSD'] },
        Manufacturing: { schema: 'manufacturing_schema', label: 'Manufacturing & Industrial', label_ar: 'التصنيع والصناعة', demoSector: 'manufacturing', authorities: ['SASO', 'MODON', 'MHRSD'] },
    };

    // -----------------------------------------------
    // Market → Sentinel Scraper Mapping
    // -----------------------------------------------
    const MARKET_SENTINEL_MAP = {
        SA: { scrapers: ['Sentinel_KSA'], cloud: 'STC Cloud', residency: 'Kingdom of Saudi Arabia' },
        AE: { scrapers: ['Sentinel_UAE'], cloud: 'du Cloud / G42', residency: 'United Arab Emirates' },
        BH: { scrapers: ['Sentinel_BHR'], cloud: 'AWS Bahrain', residency: 'Kingdom of Bahrain' },
        QA: { scrapers: ['Sentinel_QAT'], cloud: 'Ooredoo Cloud', residency: 'State of Qatar' },
        KW: { scrapers: ['Sentinel_KWT'], cloud: 'Zain Cloud', residency: 'State of Kuwait' },
        OM: { scrapers: ['Sentinel_OMN'], cloud: 'Omantel Cloud', residency: 'Sultanate of Oman' },
        EG: { scrapers: ['Sentinel_EGY'], cloud: 'Telecom Egypt', residency: 'Arab Republic of Egypt' },
        JO: { scrapers: ['Sentinel_JOR'], cloud: 'Umniah Cloud', residency: 'Hashemite Kingdom of Jordan' },
        GB: { scrapers: ['Sentinel_GBR'], cloud: 'AWS London', residency: 'United Kingdom' },
        US: { scrapers: ['Sentinel_USA'], cloud: 'AWS Virginia', residency: 'United States of America' },
        DE: { scrapers: ['Sentinel_DEU'], cloud: 'AWS Frankfurt', residency: 'Federal Republic of Germany' },
        FR: { scrapers: ['Sentinel_FRA'], cloud: 'OVH Cloud', residency: 'French Republic' },
        SG: { scrapers: ['Sentinel_SGP'], cloud: 'AWS Singapore', residency: 'Republic of Singapore' },
        IN: { scrapers: ['Sentinel_IND'], cloud: 'AWS Mumbai', residency: 'Republic of India' },
        MY: { scrapers: ['Sentinel_MYS'], cloud: 'TM Cloud', residency: 'Malaysia' },
        // Fallback for unmapped markets
        _default: { scrapers: ['Sentinel_GLOBAL'], cloud: 'AWS Global', residency: 'International' },
    };

    // -----------------------------------------------
    // Language → NMT (Neural Machine Translation) Config
    // -----------------------------------------------
    const NMT_LOCALE_MAP = {
        en: { locale: 'en-US', engine: 'NeuralTranslationMatrix', label: 'English', dir: 'ltr' },
        ar: { locale: 'ar-SA', engine: 'NeuralTranslationMatrix', label: 'العربية', dir: 'rtl' },
        de: { locale: 'de-DE', engine: 'NeuralTranslationMatrix', label: 'Deutsch', dir: 'ltr' },
        fr: { locale: 'fr-FR', engine: 'NeuralTranslationMatrix', label: 'Français', dir: 'ltr' },
        es: { locale: 'es-ES', engine: 'NeuralTranslationMatrix', label: 'Español', dir: 'ltr' },
        pt: { locale: 'pt-BR', engine: 'NeuralTranslationMatrix', label: 'Português', dir: 'ltr' },
        zh: { locale: 'zh-CN', engine: 'NeuralTranslationMatrix', label: '中文', dir: 'ltr' },
        ja: { locale: 'ja-JP', engine: 'NeuralTranslationMatrix', label: '日本語', dir: 'ltr' },
        ko: { locale: 'ko-KR', engine: 'NeuralTranslationMatrix', label: '한국어', dir: 'ltr' },
        hi: { locale: 'hi-IN', engine: 'NeuralTranslationMatrix', label: 'हिन्दी', dir: 'ltr' },
        ur: { locale: 'ur-PK', engine: 'NeuralTranslationMatrix', label: 'اردو', dir: 'rtl' },
        tr: { locale: 'tr-TR', engine: 'NeuralTranslationMatrix', label: 'Türkçe', dir: 'ltr' },
        ru: { locale: 'ru-RU', engine: 'NeuralTranslationMatrix', label: 'Русский', dir: 'ltr' },
        it: { locale: 'it-IT', engine: 'NeuralTranslationMatrix', label: 'Italiano', dir: 'ltr' },
        nl: { locale: 'nl-NL', engine: 'NeuralTranslationMatrix', label: 'Nederlands', dir: 'ltr' },
        pl: { locale: 'pl-PL', engine: 'NeuralTranslationMatrix', label: 'Polski', dir: 'ltr' },
        sv: { locale: 'sv-SE', engine: 'NeuralTranslationMatrix', label: 'Svenska', dir: 'ltr' },
        th: { locale: 'th-TH', engine: 'NeuralTranslationMatrix', label: 'ไทย', dir: 'ltr' },
        vi: { locale: 'vi-VN', engine: 'NeuralTranslationMatrix', label: 'Tiếng Việt', dir: 'ltr' },
        ms: { locale: 'ms-MY', engine: 'NeuralTranslationMatrix', label: 'Bahasa Melayu', dir: 'ltr' },
        id: { locale: 'id-ID', engine: 'NeuralTranslationMatrix', label: 'Bahasa Indonesia', dir: 'ltr' },
        bn: { locale: 'bn-BD', engine: 'NeuralTranslationMatrix', label: 'বাংলা', dir: 'ltr' },
        fa: { locale: 'fa-IR', engine: 'NeuralTranslationMatrix', label: 'فارسی', dir: 'rtl' },
        he: { locale: 'he-IL', engine: 'NeuralTranslationMatrix', label: 'עברית', dir: 'rtl' },
        sw: { locale: 'sw-KE', engine: 'NeuralTranslationMatrix', label: 'Kiswahili', dir: 'ltr' },
        tl: { locale: 'tl-PH', engine: 'NeuralTranslationMatrix', label: 'Tagalog', dir: 'ltr' },
    };

    // -----------------------------------------------
    // Core: Initialize Session
    // -----------------------------------------------
    function initialize({ market, industry, language }) {
        // Validate inputs
        if (!INDUSTRY_SCHEMA_MAP[industry]) {
            throw new Error(`[SessionArchitect] Unknown industry: ${industry}`);
        }

        const siloId = `silo_${industry.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
        const schemaConfig = INDUSTRY_SCHEMA_MAP[industry];
        const marketConfig = MARKET_SENTINEL_MAP[market] || MARKET_SENTINEL_MAP._default;
        const nmtConfig = NMT_LOCALE_MAP[language] || NMT_LOCALE_MAP.en;

        const session = {
            version: VERSION,
            siloId,
            createdAt: new Date().toISOString(),

            // Market Context
            market: {
                isoCode: market,
                ...marketConfig,
            },

            // Industry Vertical
            industry: {
                key: industry,
                ...schemaConfig,
            },

            // Language / NMT
            language: {
                code: language,
                ...nmtConfig,
            },

            // Sovereignty
            sovereignty: {
                dataResidency: marketConfig.residency,
                cloud: marketConfig.cloud,
                encryption: 'TLS 1.3 + AES-256-GCM',
            },

            // Active state
            active: true,
        };

        // Hard-Silo Write: Clear any previous session, write new one
        _clearSilo();
        sessionStorage.setItem(SILO_KEY, JSON.stringify(session));
        sessionStorage.setItem(`${SILO_KEY}:${siloId}`, JSON.stringify(session));

        console.log(`[SessionArchitect] Session initialized`);
        console.log(`  → Silo: ${siloId}`);
        console.log(`  → Schema: ${schemaConfig.schema}`);
        console.log(`  → Market: ${market} (${marketConfig.residency})`);
        console.log(`  → Sentinels: ${marketConfig.scrapers.join(', ')}`);
        console.log(`  → NMT: ${nmtConfig.locale} via ${nmtConfig.engine}`);

        return session;
    }

    // -----------------------------------------------
    // Core: Get Active Session
    // -----------------------------------------------
    function getSession() {
        const raw = sessionStorage.getItem(SILO_KEY);
        if (!raw) return null;

        try {
            const session = JSON.parse(raw);
            if (!session.active || !session.siloId) return null;
            return session;
        } catch {
            return null;
        }
    }

    // -----------------------------------------------
    // Core: Destroy Session (logout)
    // -----------------------------------------------
    function destroySession() {
        const session = getSession();
        if (session?.siloId) {
            sessionStorage.removeItem(`${SILO_KEY}:${session.siloId}`);
        }
        sessionStorage.removeItem(SILO_KEY);
        console.log('[SessionArchitect] Session destroyed — silo purged');
    }

    // -----------------------------------------------
    // Core: Hard-Silo Validation
    // Ensures getSession() never returns data from
    // a different industry silo
    // -----------------------------------------------
    function validateSilo(expectedIndustry) {
        const session = getSession();
        if (!session) return false;
        return session.industry.key === expectedIndustry;
    }

    // -----------------------------------------------
    // Internal: Clear previous silo
    // -----------------------------------------------
    function _clearSilo() {
        const existing = getSession();
        if (existing?.siloId) {
            sessionStorage.removeItem(`${SILO_KEY}:${existing.siloId}`);
        }
        sessionStorage.removeItem(SILO_KEY);
    }

    // -----------------------------------------------
    // Public: Expose maps for the Gateway UI
    // -----------------------------------------------
    function getIndustries() {
        return Object.entries(INDUSTRY_SCHEMA_MAP).map(([key, val]) => ({
            key,
            label: val.label,
            label_ar: val.label_ar,
            demoSector: val.demoSector,
            authorities: val.authorities,
        }));
    }

    function getLanguages() {
        return Object.entries(NMT_LOCALE_MAP).map(([code, val]) => ({
            code,
            label: val.label,
            locale: val.locale,
            dir: val.dir,
        }));
    }

    // -----------------------------------------------
    // Public API
    // -----------------------------------------------
    return {
        initialize,
        getSession,
        destroySession,
        validateSilo,
        getIndustries,
        getLanguages,
        VERSION,
    };
})();

// Export for module environments (Node.js tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionArchitect;
}
