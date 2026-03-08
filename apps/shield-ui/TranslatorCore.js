// ============================================
// SAQR — TranslatorCore (Neural Translation Matrix)
// Industry-Aware Any-to-Any Translation Engine
// with "See Original" Legal Transparency
// ============================================

const TranslatorCore = (() => {
    'use strict';

    let _enabled = false;
    let _targetLang = 'en';
    let _industryKey = null;

    // -----------------------------------------------
    // Industry-Specific Terminology Glossaries
    // Same term can mean different things per vertical
    // -----------------------------------------------
    const INDUSTRY_GLOSSARY = {
        BFSI: {
            en: { batch: 'Transaction Batch', exposure: 'Financial Exposure', cap: 'Regulatory Cap', drift: 'Regulatory Drift', breach: 'Compliance Breach', circular: 'Regulatory Circular', cooling: 'Cooling-Off Period' },
            ar: { batch: 'دفعة معاملات', exposure: 'التعرض المالي', cap: 'الحد التنظيمي', drift: 'الانحراف التنظيمي', breach: 'خرق الامتثال', circular: 'تعميم تنظيمي', cooling: 'فترة التهدئة' },
            de: { batch: 'Transaktionsstapel', exposure: 'Finanzielle Exponierung', cap: 'Regulatorische Obergrenze', drift: 'Regulatorische Abweichung', breach: 'Compliance-Verstoß', circular: 'Regulatorisches Rundschreiben', cooling: 'Widerrufsfrist' },
            fr: { batch: 'Lot de transactions', exposure: 'Exposition financière', cap: 'Plafond réglementaire', drift: 'Dérive réglementaire', breach: 'Violation de conformité', circular: 'Circulaire réglementaire', cooling: 'Délai de rétractation' },
            es: { batch: 'Lote de transacciones', exposure: 'Exposición financiera', cap: 'Tope regulatorio', drift: 'Desviación regulatoria', breach: 'Incumplimiento normativo', circular: 'Circular regulatoria', cooling: 'Período de desistimiento' },
            zh: { batch: '交易批次', exposure: '财务风险敞口', cap: '监管上限', drift: '监管偏移', breach: '合规违规', circular: '监管通告', cooling: '冷静期' },
            ja: { batch: '取引バッチ', exposure: '財務エクスポージャー', cap: '規制上限', drift: '規制ドリフト', breach: 'コンプライアンス違反', circular: '規制通達', cooling: 'クーリングオフ期間' },
        },
        Manufacturing: {
            en: { batch: 'Production Batch', exposure: 'Safety Exposure', cap: 'Emission Cap', drift: 'Standards Drift', breach: 'Safety Violation', circular: 'Industrial Directive', cooling: 'Shutdown Period' },
            ar: { batch: 'دفعة إنتاج', exposure: 'التعرض للسلامة', cap: 'حد الانبعاثات', drift: 'انحراف المعايير', breach: 'مخالفة السلامة', circular: 'توجيه صناعي', cooling: 'فترة الإغلاق' },
            de: { batch: 'Produktionscharge', exposure: 'Sicherheitsrisiko', cap: 'Emissionsobergrenze', drift: 'Normabweichung', breach: 'Sicherheitsverstoß', circular: 'Industrierichtlinie', cooling: 'Stillstandszeit' },
            fr: { batch: 'Lot de production', exposure: 'Exposition sécuritaire', cap: "Plafond d'émissions", drift: 'Dérive normative', breach: 'Violation de sécurité', circular: 'Directive industrielle', cooling: "Période d'arrêt" },
        },
        Healthcare: {
            en: { batch: 'Specimen Batch', exposure: 'Patient Exposure', cap: 'Dosage Cap', drift: 'Protocol Drift', breach: 'Protocol Breach', circular: 'Health Advisory', cooling: 'Quarantine Period' },
            ar: { batch: 'دفعة عينات', exposure: 'تعرض المريض', cap: 'حد الجرعة', drift: 'انحراف البروتوكول', breach: 'خرق البروتوكول', circular: 'نشرة صحية', cooling: 'فترة الحجر' },
            de: { batch: 'Probencharge', exposure: 'Patientenexposition', cap: 'Dosierungsobergrenze', drift: 'Protokollabweichung', breach: 'Protokollverstoß', circular: 'Gesundheitshinweis', cooling: 'Quarantänezeitraum' },
        },
        'F&B': {
            en: { batch: 'Food Batch', exposure: 'Health Exposure', cap: 'Additive Cap', drift: 'Hygiene Drift', breach: 'Hygiene Breach', circular: 'Food Safety Notice', cooling: 'Recall Period' },
            ar: { batch: 'دفعة غذائية', exposure: 'التعرض الصحي', cap: 'حد الإضافات', drift: 'انحراف النظافة', breach: 'خرق النظافة', circular: 'إشعار سلامة الغذاء', cooling: 'فترة الاستدعاء' },
        },
    };

    // -----------------------------------------------
    // Core Translation Dictionaries (Demo Mode)
    // In production, these would call an NMT API
    // -----------------------------------------------
    const TRANSLATIONS = {
        // --- Compliance / Regulatory Terms ---
        de: {
            'OUT OF COMPLIANCE': 'NICHT KONFORM',
            'Violation': 'Verstoß', 'violation': 'Verstoß',
            'Critical': 'Kritisch', 'critical': 'kritisch',
            'High': 'Hoch', 'high': 'hoch',
            'Medium': 'Mittel', 'medium': 'mittel',
            'Max admin fee': 'Maximale Verwaltungsgebühr',
            'Min font size': 'Mindestschriftgröße',
            'Max processing time': 'Maximale Bearbeitungszeit',
            'Max cash advance fee': 'Maximale Barvorschussgebühr',
            'CDC stream': 'CDC-Datenstrom',
            'above cap': 'über dem Limit',
            'below minimum': 'unter dem Minimum',
            'overdue': 'überfällig',
            'Phase A — Rule Engine': 'Phase A — Regelwerk-Engine',
            'Intelligence Reveal': 'Intelligenz-Enthüllung',
            'Source Circular': 'Quell-Rundschreiben',
            'Constraint': 'Einschränkung',
            'Live CDC Data': 'Live-CDC-Daten',
            'Verdict': 'Urteil',
            'Potential Fine': 'Mögliche Geldstrafe',
            'Hashed Link': 'Gehashter Link',
            'Pipeline': 'Pipeline',
            'SME Fee Cap Breach': 'KMU-Gebührenobergrenze überschritten',
            'Exceeded Approved Fee Cap': 'Genehmigte Gebührenobergrenze überschritten',
            'Cooling-Off Period Violation': 'Verstoß gegen die Widerrufsfrist',
            'Disclosure Font Size Below 14pt': 'Schriftgröße der Offenlegung unter 14pt',
            'Cash Advance Fee Exceeds Schedule': 'Barvorschussgebühr überschreitet Plan',
            'Cold Chain Breach': 'Kühlketten-Bruch',
            'Hygiene Protocol Breach': 'Hygiene-Protokoll-Verstoß',
            'Expired Product on Display Shelf': 'Abgelaufenes Produkt im Regal',
            'Damaged Commercial Signage': 'Beschädigte Geschäftsbeschilderung',
            'Sidewalk Encroachment': 'Gehwegübergriff',
            'days': 'Tage',
        },
        fr: {
            'OUT OF COMPLIANCE': 'NON CONFORME',
            'Violation': 'Infraction', 'violation': 'infraction',
            'Critical': 'Critique', 'critical': 'critique',
            'High': 'Élevé', 'high': 'élevé',
            'Medium': 'Moyen', 'medium': 'moyen',
            'Max admin fee': 'Frais administratifs maximum',
            'Min font size': 'Taille de police minimale',
            'Max processing time': 'Délai de traitement maximum',
            'Max cash advance fee': "Frais d'avance de fonds maximum",
            'CDC stream': 'Flux CDC',
            'above cap': 'au-dessus du plafond',
            'below minimum': 'en dessous du minimum',
            'overdue': 'en retard',
            'Phase A — Rule Engine': 'Phase A — Moteur de règles',
            'Intelligence Reveal': "Révélation d'intelligence",
            'Source Circular': 'Circulaire source',
            'Constraint': 'Contrainte',
            'Live CDC Data': 'Données CDC en direct',
            'Verdict': 'Verdict',
            'Potential Fine': 'Amende potentielle',
            'Hashed Link': 'Lien haché',
            'Pipeline': 'Pipeline',
            'SME Fee Cap Breach': 'Dépassement du plafond PME',
            'Exceeded Approved Fee Cap': 'Plafond de frais approuvé dépassé',
            'Cooling-Off Period Violation': 'Violation du délai de rétractation',
            'Disclosure Font Size Below 14pt': 'Police de divulgation inférieure à 14pt',
            'Cash Advance Fee Exceeds Schedule': "Frais d'avance dépassent le barème",
            'Cold Chain Breach': 'Rupture de la chaîne du froid',
            'Hygiene Protocol Breach': "Violation du protocole d'hygiène",
            'Expired Product on Display Shelf': 'Produit périmé en rayon',
            'Damaged Commercial Signage': 'Signalétique commerciale endommagée',
            'Sidewalk Encroachment': 'Empiétement sur trottoir',
            'days': 'jours',
        },
        es: {
            'OUT OF COMPLIANCE': 'FUERA DE CUMPLIMIENTO',
            'Violation': 'Infracción', 'violation': 'infracción',
            'Critical': 'Crítico', 'critical': 'crítico',
            'High': 'Alto', 'high': 'alto',
            'Medium': 'Medio', 'medium': 'medio',
            'Phase A — Rule Engine': 'Fase A — Motor de reglas',
            'Intelligence Reveal': 'Revelación de inteligencia',
            'Source Circular': 'Circular fuente',
            'Constraint': 'Restricción',
            'Live CDC Data': 'Datos CDC en vivo',
            'Verdict': 'Veredicto',
            'Potential Fine': 'Multa potencial',
            'Hashed Link': 'Enlace hash',
            'Pipeline': 'Pipeline',
            'SME Fee Cap Breach': 'Incumplimiento del tope PYME',
            'Cold Chain Breach': 'Rotura de cadena de frío',
            'days': 'días',
        },
        zh: {
            'OUT OF COMPLIANCE': '不合规',
            'Violation': '违规', 'violation': '违规',
            'Critical': '严重', 'critical': '严重',
            'High': '高', 'high': '高',
            'Medium': '中等', 'medium': '中等',
            'Phase A — Rule Engine': '阶段A — 规则引擎',
            'Intelligence Reveal': '智能揭示',
            'Source Circular': '来源通告',
            'Constraint': '约束条件',
            'Live CDC Data': '实时CDC数据',
            'Verdict': '判定',
            'Potential Fine': '潜在罚款',
            'Hashed Link': '哈希链接',
            'Pipeline': '管线',
            'SME Fee Cap Breach': '中小企业费用上限违规',
            'Cold Chain Breach': '冷链断裂',
            'days': '天',
        },
        ja: {
            'OUT OF COMPLIANCE': 'コンプライアンス違反',
            'Violation': '違反', 'violation': '違反',
            'Critical': '重大', 'critical': '重大',
            'High': '高', 'high': '高',
            'Medium': '中', 'medium': '中',
            'Phase A — Rule Engine': 'フェーズA — ルールエンジン',
            'Intelligence Reveal': 'インテリジェンス・リビール',
            'Source Circular': '情報源通達',
            'Constraint': '制約',
            'Live CDC Data': 'リアルタイムCDCデータ',
            'Verdict': '判定',
            'Potential Fine': '想定罰金',
            'Hashed Link': 'ハッシュリンク',
            'Pipeline': 'パイプライン',
            'days': '日',
        },
        ko: {
            'OUT OF COMPLIANCE': '규정 미준수',
            'Violation': '위반', 'violation': '위반',
            'Critical': '심각', 'critical': '심각',
            'Phase A — Rule Engine': '단계 A — 규칙 엔진',
            'Intelligence Reveal': '인텔리전스 리빌',
            'Source Circular': '출처 회람',
            'Constraint': '제약 조건',
            'Live CDC Data': '실시간 CDC 데이터',
            'Verdict': '판결',
            'Potential Fine': '예상 벌금',
            'days': '일',
        },
        hi: {
            'OUT OF COMPLIANCE': 'अनुपालन उल्लंघन',
            'Violation': 'उल्लंघन', 'violation': 'उल्लंघन',
            'Critical': 'गंभीर', 'critical': 'गंभीर',
            'Phase A — Rule Engine': 'चरण ए — नियम इंजन',
            'Intelligence Reveal': 'इंटेलिजेंस रिवील',
            'Source Circular': 'स्रोत परिपत्र',
            'Constraint': 'बाधा',
            'Live CDC Data': 'लाइव सीडीसी डेटा',
            'Verdict': 'फैसला',
            'Potential Fine': 'संभावित जुर्माना',
            'days': 'दिन',
        },
        tr: {
            'OUT OF COMPLIANCE': 'UYUMSUZ',
            'Violation': 'İhlal', 'violation': 'ihlal',
            'Critical': 'Kritik', 'critical': 'kritik',
            'Phase A — Rule Engine': 'Aşama A — Kural Motoru',
            'Intelligence Reveal': 'İstihbarat Açıklaması',
            'Source Circular': 'Kaynak Genelge',
            'Constraint': 'Kısıtlama',
            'Live CDC Data': 'Canlı CDC Verileri',
            'Verdict': 'Karar',
            'Potential Fine': 'Olası Ceza',
            'days': 'gün',
        },
        ru: {
            'OUT OF COMPLIANCE': 'НАРУШЕНИЕ СООТВЕТСТВИЯ',
            'Violation': 'Нарушение', 'violation': 'нарушение',
            'Critical': 'Критический', 'critical': 'критический',
            'Phase A — Rule Engine': 'Фаза A — Механизм правил',
            'Intelligence Reveal': 'Разведывательные данные',
            'Source Circular': 'Исходный циркуляр',
            'Constraint': 'Ограничение',
            'Live CDC Data': 'Данные CDC в реальном времени',
            'Verdict': 'Вердикт',
            'Potential Fine': 'Потенциальный штраф',
            'days': 'дней',
        },
    };

    // -----------------------------------------------
    // Initialize from SessionArchitect
    // -----------------------------------------------
    function init() {
        if (typeof SessionArchitect !== 'undefined') {
            const session = SessionArchitect.getSession();
            if (session) {
                _targetLang = session.language.code || 'en';
                _industryKey = session.industry.key || null;
            }
        }
    }

    // -----------------------------------------------
    // Core: Translate a string
    // -----------------------------------------------
    function translate(text, targetLang) {
        const lang = targetLang || _targetLang;
        if (lang === 'en') return text; // English is the source language
        if (lang === 'ar') return text; // Arabic handled by existing i18n

        const dict = TRANSLATIONS[lang];
        if (!dict) return text;

        let result = text;

        // Sort keys by length (longest first) to avoid partial matches
        const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
        for (const key of keys) {
            if (result.includes(key)) {
                result = result.split(key).join(dict[key]);
            }
        }

        return result;
    }

    // -----------------------------------------------
    // Core: Get industry-specific term
    // -----------------------------------------------
    function getTerm(term, targetLang) {
        const lang = targetLang || _targetLang;
        const industry = _industryKey;

        if (industry && INDUSTRY_GLOSSARY[industry]) {
            const langTerms = INDUSTRY_GLOSSARY[industry][lang];
            if (langTerms && langTerms[term]) {
                return langTerms[term];
            }
            // Fallback to English industry term
            const enTerms = INDUSTRY_GLOSSARY[industry]['en'];
            if (enTerms && enTerms[term]) {
                return enTerms[term];
            }
        }

        return term;
    }

    // -----------------------------------------------
    // UI: Wrap text in a translatable span with
    // "See Original" toggle
    // -----------------------------------------------
    function wrapTranslatable(originalText, translatedText, id) {
        if (originalText === translatedText || !_enabled) {
            return originalText;
        }

        return `<span class="ntm-translated" data-ntm-id="${id}">` +
            `<span class="ntm-text ntm-active">${translatedText}</span>` +
            `<span class="ntm-original">${originalText}</span>` +
            `<button class="ntm-native-btn" onclick="TranslatorCore.toggleOriginal('${id}')" title="See Original / Native Text">` +
            `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
            `<path d="M12 20l9-5-9-5-9 5 9 5z"/><path d="M12 12l9-5-9-5-9 5 9 5z"/>` +
            `</svg></button></span>`;
    }

    // -----------------------------------------------
    // UI: Toggle between translated and original
    // -----------------------------------------------
    function toggleOriginal(id) {
        const container = document.querySelector(`[data-ntm-id="${id}"]`);
        if (!container) return;

        const translated = container.querySelector('.ntm-text');
        const original = container.querySelector('.ntm-original');
        const btn = container.querySelector('.ntm-native-btn');

        if (!translated || !original) return;

        const showingOriginal = original.classList.contains('ntm-active');

        if (showingOriginal) {
            original.classList.remove('ntm-active');
            translated.classList.add('ntm-active');
            container.classList.remove('ntm-showing-original');
        } else {
            translated.classList.remove('ntm-active');
            original.classList.add('ntm-active');
            container.classList.add('ntm-showing-original');
        }
    }

    // -----------------------------------------------
    // Batch: Translate all translatable elements
    // on the current page
    // -----------------------------------------------
    function translatePage() {
        if (!_enabled) return;

        document.querySelectorAll('[data-ntm-translatable]').forEach(el => {
            const original = el.getAttribute('data-ntm-original') || el.textContent;
            el.setAttribute('data-ntm-original', original);
            el.textContent = translate(original);
        });
    }

    // -----------------------------------------------
    // Batch: Restore all translated elements
    // -----------------------------------------------
    function restorePage() {
        document.querySelectorAll('[data-ntm-translatable]').forEach(el => {
            const original = el.getAttribute('data-ntm-original');
            if (original) el.textContent = original;
        });
    }

    // -----------------------------------------------
    // State: Enable / Disable
    // -----------------------------------------------
    function enable() {
        _enabled = true;
        document.documentElement.setAttribute('data-ntm', 'active');
        console.log(`[NTM] Neural Translation Matrix ACTIVE → ${_targetLang} (${_industryKey || 'generic'})`);
    }

    function disable() {
        _enabled = false;
        document.documentElement.removeAttribute('data-ntm');
        restorePage();
        console.log('[NTM] Neural Translation Matrix DISABLED');
    }

    function toggle() {
        if (_enabled) { disable(); return false; }
        else { enable(); return true; }
    }

    function isEnabled() { return _enabled; }
    function getTargetLang() { return _targetLang; }
    function setTargetLang(lang) { _targetLang = lang; }
    function getIndustry() { return _industryKey; }

    // -----------------------------------------------
    // Public API
    // -----------------------------------------------
    return {
        init,
        translate,
        getTerm,
        wrapTranslatable,
        toggleOriginal,
        translatePage,
        restorePage,
        enable,
        disable,
        toggle,
        isEnabled,
        getTargetLang,
        setTargetLang,
        getIndustry,
    };
})();

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TranslatorCore;
}
