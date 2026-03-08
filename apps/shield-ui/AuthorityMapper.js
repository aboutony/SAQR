// ============================================
// SAQR — AuthorityMapper
// Market + Industry → Regulatory Authority Grid
// Dynamically renders the Heartbeat Grid
// ============================================

const AuthorityMapper = (() => {
    'use strict';

    // -----------------------------------------------
    // SVG Icon Library (Feather-style)
    // -----------------------------------------------
    const ICONS = {
        bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
        data: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
        tax: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
        chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',
        health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
        home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
        people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
        shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
        globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
        factory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/><path d="M19 8h2v12"/></svg>',
        food: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>',
        tourism: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
        briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>',
        building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/></svg>',
        award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
    };

    // -----------------------------------------------
    // Authority Registries Per Market + Industry
    // -----------------------------------------------
    const REGISTRIES = {
        // ====== KSA ======
        'SA|BFSI': [
            { code: 'SAMA', name: 'Saudi Central Bank', icon: 'bank', regs: 87 },
            { code: 'CMA', name: 'Capital Market Authority', icon: 'chart', regs: 64 },
            { code: 'ZATCA', name: 'Zakat, Tax & Customs', icon: 'tax', regs: 52 },
            { code: 'SDAIA', name: 'Saudi Data & AI Authority', icon: 'data', regs: 38 },
            { code: 'GOSI', name: 'General Org for Social Ins.', icon: 'shield', regs: 29 },
            { code: 'MHRSD', name: 'Ministry of HR & Social Dev.', icon: 'people', regs: 44 },
            { code: 'MoC', name: 'Ministry of Commerce', icon: 'briefcase', regs: 31 },
        ],
        'SA|Healthcare': [
            { code: 'MOH', name: 'Ministry of Health', icon: 'health', regs: 96 },
            { code: 'SFDA', name: 'Saudi FDA', icon: 'chart', regs: 73 },
            { code: 'PHAP', name: 'Pharma & Herb Authority', icon: 'shield', regs: 41 },
            { code: 'CHI', name: 'Council of Health Insurance', icon: 'award', regs: 34 },
            { code: 'SDAIA', name: 'Saudi Data & AI Authority', icon: 'data', regs: 38 },
            { code: 'MHRSD', name: 'Ministry of HR & Social Dev.', icon: 'people', regs: 27 },
            { code: 'MoC', name: 'Ministry of Commerce', icon: 'briefcase', regs: 22 },
        ],
        'SA|F&B': [
            { code: 'SFDA', name: 'Saudi FDA', icon: 'chart', regs: 58 },
            { code: 'MOMAH', name: 'Ministry of Municipal', icon: 'home', regs: 42 },
            { code: 'ZATCA', name: 'Zakat, Tax & Customs', icon: 'tax', regs: 31 },
            { code: 'SASO', name: 'Saudi Standards Authority', icon: 'award', regs: 28 },
            { code: 'SDAIA', name: 'Saudi Data & AI Authority', icon: 'data', regs: 19 },
            { code: 'MHRSD', name: 'Ministry of HR & Social Dev.', icon: 'people', regs: 22 },
        ],
        'SA|Hospitality': [
            { code: 'MOT', name: 'Ministry of Tourism', icon: 'tourism', regs: 45 },
            { code: 'MOMAH', name: 'Ministry of Municipal', icon: 'home', regs: 38 },
            { code: 'ZATCA', name: 'Zakat, Tax & Customs', icon: 'tax', regs: 31 },
            { code: 'SFDA', name: 'Saudi FDA', icon: 'chart', regs: 24 },
            { code: 'MHRSD', name: 'Ministry of HR & Social Dev.', icon: 'people', regs: 29 },
            { code: 'SDAIA', name: 'Saudi Data & AI Authority', icon: 'data', regs: 18 },
        ],
        'SA|Education': [
            { code: 'MOE', name: 'Ministry of Education', icon: 'book', regs: 63 },
            { code: 'ETEC', name: 'Education & Training Eval.', icon: 'award', regs: 37 },
            { code: 'SDAIA', name: 'Saudi Data & AI Authority', icon: 'data', regs: 25 },
            { code: 'MHRSD', name: 'Ministry of HR & Social Dev.', icon: 'people', regs: 31 },
            { code: 'MoC', name: 'Ministry of Commerce', icon: 'briefcase', regs: 18 },
        ],
        'SA|Manufacturing': [
            { code: 'SASO', name: 'Saudi Standards Authority', icon: 'award', regs: 72 },
            { code: 'MODON', name: 'Industrial Cities Auth.', icon: 'factory', regs: 48 },
            { code: 'MHRSD', name: 'Ministry of HR & Social Dev.', icon: 'people', regs: 35 },
            { code: 'SFDA', name: 'Saudi FDA', icon: 'chart', regs: 29 },
            { code: 'ZATCA', name: 'Zakat, Tax & Customs', icon: 'tax', regs: 31 },
            { code: 'SDAIA', name: 'Saudi Data & AI Authority', icon: 'data', regs: 22 },
            { code: 'MoEP', name: 'Min. of Energy & Petroleum', icon: 'globe', regs: 18 },
        ],

        // ====== UAE ======
        'AE|BFSI': [
            { code: 'CBUAE', name: 'Central Bank of UAE', icon: 'bank', regs: 78 },
            { code: 'SCA', name: 'Securities & Commodities', icon: 'chart', regs: 52 },
            { code: 'FTA', name: 'Federal Tax Authority', icon: 'tax', regs: 41 },
            { code: 'TDRA', name: 'Telecom & Digital Gov.', icon: 'data', regs: 33 },
            { code: 'MoHRE', name: 'Ministry of HR & Emiratisation', icon: 'people', regs: 38 },
            { code: 'MoEC', name: 'Ministry of Economy', icon: 'briefcase', regs: 27 },
        ],
    };

    // -----------------------------------------------
    // Global Fallback (Generic) Authorities
    // -----------------------------------------------
    const GLOBAL_FALLBACKS = {
        BFSI: [
            { code: 'CB', name: 'Central Bank (Local)', icon: 'bank', regs: 65 },
            { code: 'SEC', name: 'Securities Commission', icon: 'chart', regs: 48 },
            { code: 'TAX', name: 'Tax Authority', icon: 'tax', regs: 37 },
            { code: 'DPA', name: 'Data Privacy Authority', icon: 'data', regs: 29 },
            { code: 'LAB', name: 'Labor Authority', icon: 'people', regs: 24 },
            { code: 'SI', name: 'Social Insurance', icon: 'shield', regs: 18 },
            { code: 'COM', name: 'Commerce Ministry', icon: 'briefcase', regs: 21 },
        ],
        Healthcare: [
            { code: 'MOH', name: 'Ministry of Health', icon: 'health', regs: 72 },
            { code: 'FDA', name: 'Food & Drug Authority', icon: 'chart', regs: 58 },
            { code: 'INS', name: 'Health Insurance Authority', icon: 'shield', regs: 34 },
            { code: 'DPA', name: 'Data Privacy Authority', icon: 'data', regs: 29 },
            { code: 'LAB', name: 'Labor Authority', icon: 'people', regs: 22 },
        ],
        'F&B': [
            { code: 'FSA', name: 'Food Safety Authority', icon: 'food', regs: 48 },
            { code: 'MUN', name: 'Municipal Authority', icon: 'home', regs: 35 },
            { code: 'TAX', name: 'Tax Authority', icon: 'tax', regs: 28 },
            { code: 'DPA', name: 'Data Privacy Authority', icon: 'data', regs: 16 },
            { code: 'LAB', name: 'Labor Authority', icon: 'people', regs: 19 },
        ],
        Hospitality: [
            { code: 'TOU', name: 'Tourism Authority', icon: 'tourism', regs: 38 },
            { code: 'MUN', name: 'Municipal Authority', icon: 'home', regs: 32 },
            { code: 'TAX', name: 'Tax Authority', icon: 'tax', regs: 26 },
            { code: 'LAB', name: 'Labor Authority', icon: 'people', regs: 21 },
        ],
        Education: [
            { code: 'EDU', name: 'Education Ministry', icon: 'book', regs: 52 },
            { code: 'QA', name: 'Quality Assurance', icon: 'award', regs: 31 },
            { code: 'DPA', name: 'Data Privacy Authority', icon: 'data', regs: 22 },
            { code: 'LAB', name: 'Labor Authority', icon: 'people', regs: 18 },
        ],
        Manufacturing: [
            { code: 'STD', name: 'Standards Authority', icon: 'award', regs: 62 },
            { code: 'OSHA', name: 'Occupational Safety', icon: 'shield', regs: 48 },
            { code: 'ENV', name: 'Environmental Agency', icon: 'globe', regs: 35 },
            { code: 'TAX', name: 'Tax Authority', icon: 'tax', regs: 28 },
            { code: 'LAB', name: 'Labor Authority', icon: 'people', regs: 24 },
            { code: 'ISO', name: 'ISO Compliance', icon: 'award', regs: 31 },
        ],
    };

    // -----------------------------------------------
    // Regulation Count Per Industry
    // -----------------------------------------------
    const REG_COUNTS = {
        BFSI: { min: 380, max: 420, label: '400+' },
        Healthcare: { min: 290, max: 340, label: '300+' },
        'F&B': { min: 110, max: 140, label: '120+' },
        Hospitality: { min: 150, max: 190, label: '170+' },
        Education: { min: 130, max: 170, label: '150+' },
        Manufacturing: { min: 220, max: 270, label: '250+' },
    };

    // -----------------------------------------------
    // Core: Get authorities for market + industry
    // -----------------------------------------------
    function getAuthorities(marketCode, industryKey) {
        const key = `${marketCode}|${industryKey}`;
        if (REGISTRIES[key]) return REGISTRIES[key];

        // Fallback to global generic
        if (GLOBAL_FALLBACKS[industryKey]) return GLOBAL_FALLBACKS[industryKey];

        // Ultimate fallback: BFSI global
        return GLOBAL_FALLBACKS.BFSI;
    }

    // -----------------------------------------------
    // Core: Get regulation count for industry
    // -----------------------------------------------
    function getRegCount(industryKey) {
        const entry = REG_COUNTS[industryKey] || REG_COUNTS.BFSI;
        const count = Math.floor(Math.random() * (entry.max - entry.min + 1)) + entry.min;
        return { count, label: entry.label };
    }

    // -----------------------------------------------
    // Core: Get cloud provider for market
    // -----------------------------------------------
    function getCloudLabel(marketCode) {
        const CLOUDS = {
            SA: 'STC Cloud (KSA)', AE: 'du Cloud / G42 (UAE)', BH: 'AWS (Bahrain)',
            QA: 'Ooredoo (Qatar)', KW: 'Zain (Kuwait)', OM: 'Omantel (Oman)',
            EG: 'Telecom Egypt', JO: 'Umniah (Jordan)', GB: 'AWS (London)',
            US: 'AWS (Virginia)', DE: 'AWS (Frankfurt)', FR: 'OVH (France)',
            SG: 'AWS (Singapore)', IN: 'AWS (Mumbai)',
        };
        return CLOUDS[marketCode] || 'AWS Global';
    }

    // -----------------------------------------------
    // Render: Generate authority grid HTML
    // -----------------------------------------------
    function renderGrid(marketCode, industryKey) {
        const authorities = getAuthorities(marketCode, industryKey);
        const cloud = getCloudLabel(marketCode);

        return authorities.map(auth => `
      <div class="authority-node" data-authority="${auth.code}">
        <div class="authority-pulse"></div>
        <svg class="authority-icon" ${ICONS[auth.icon] ? ICONS[auth.icon].replace('<svg ', '') : ICONS.shield.replace('<svg ', '')}
        <span class="authority-label">${auth.code}</span>
        <div class="authority-tooltip">${auth.name} — Source Verified via ${cloud}</div>
      </div>
    `).join('');
    }

    // -----------------------------------------------
    // Public API
    // -----------------------------------------------
    return {
        getAuthorities,
        getRegCount,
        getCloudLabel,
        renderGrid,
        ICONS,
        REG_COUNTS,
    };
})();

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthorityMapper;
}
