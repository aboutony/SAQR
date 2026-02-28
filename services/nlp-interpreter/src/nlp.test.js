// ============================================
// SAQR NLP Interpreter — Unit Tests
// ============================================

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseCircular, detectLanguage } = require('./regulatory-parser');
const { extractObligations, extractParameters } = require('./obligation-extractor');
const { detectDrift, jaccardSimilarity, compareParameters } = require('./drift-detector');

// -----------------------------------------------
// Sample SAMA Circular (Arabic)
// -----------------------------------------------
const SAMA_CIRCULAR_AR = `
تعميم حماية المستهلك - 2026

المادة 3: متطلبات الإفصاح
يجب على جميع المؤسسات المالية استخدام حجم خط لا يقل عن 14 نقطة في جميع الإفصاحات الموجهة للمستهلك.
لا يجوز تغيير شروط المنتج بعد توقيع العقد دون موافقة كتابية من العميل.

المادة 5: الرسوم والتكاليف
الحد الأقصى لرسوم السداد المبكر هو 5000 ريال أو ما يعادل 3% من المبلغ المتبقي.
يجب إبلاغ العميل بأي تغيير في الرسوم خلال 30 يوم عمل قبل تطبيقها.

المادة 7: فترة التراجع
يتعين على المؤسسة المالية منح العميل فترة تراجع لا تقل عن 10 أيام.
`;

const SAMA_CIRCULAR_UPDATED = `
تعميم حماية المستهلك - 2026 (تحديث)

المادة 3: متطلبات الإفصاح
يجب على جميع المؤسسات المالية استخدام حجم خط لا يقل عن 16 نقطة في جميع الإفصاحات الموجهة للمستهلك.
لا يجوز تغيير شروط المنتج بعد توقيع العقد دون موافقة كتابية من العميل.

المادة 5: الرسوم والتكاليف
الحد الأقصى لرسوم السداد المبكر هو 3000 ريال أو ما يعادل 2% من المبلغ المتبقي.
يجب إبلاغ العميل بأي تغيير في الرسوم خلال 15 يوم عمل قبل تطبيقها.

المادة 7: فترة التراجع
يتعين على المؤسسة المالية منح العميل فترة تراجع لا تقل عن 14 أيام.

المادة 9: الخدمات الرقمية
يجب توفير جميع الخدمات المصرفية عبر القنوات الرقمية بنفس مستوى الجودة.
`;

// -----------------------------------------------
// Parser Tests
// -----------------------------------------------
describe('Regulatory Parser', () => {
    it('detects Arabic language correctly', () => {
        assert.equal(detectLanguage(SAMA_CIRCULAR_AR), 'ar');
    });

    it('detects English language correctly', () => {
        assert.equal(detectLanguage('Article 3: Disclosure Requirements'), 'en');
    });

    it('parses Arabic circular into sections', () => {
        const result = parseCircular(SAMA_CIRCULAR_AR, {
            authority: 'SAMA',
            title: 'Consumer Protection Circular 2026',
        });

        assert.equal(result.authority, 'SAMA');
        assert.equal(result.language, 'ar');
        assert.ok(result.sections.length >= 3, `Expected ≥3 sections, got ${result.sections.length}`);
        assert.ok(result.documentId.startsWith('DOC-'));
    });
});

// -----------------------------------------------
// Obligation Extractor Tests
// -----------------------------------------------
describe('Obligation Extractor', () => {
    it('extracts obligations from Arabic SAMA circular', () => {
        const parsed = parseCircular(SAMA_CIRCULAR_AR, { authority: 'SAMA' });
        const obligations = extractObligations(parsed.sections, 'SAMA');

        assert.ok(obligations.length >= 4, `Expected ≥4 obligations, got ${obligations.length}`);

        // All obligations should have required fields
        for (const obl of obligations) {
            assert.ok(obl.obligationId.startsWith('OBL-SAMA-'));
            assert.equal(obl.authority, 'SAMA');
            assert.ok(['prohibition', 'requirement', 'threshold', 'deadline'].includes(obl.obligationType));
            assert.ok(obl.confidence > 0);
        }
    });

    it('extracts font size parameter', () => {
        const params = extractParameters('يجب استخدام حجم خط لا يقل عن 14 نقطة');
        assert.equal(params.fontSize, 14);
    });

    it('extracts currency parameter', () => {
        const params = extractParameters('الحد الأقصى للرسوم هو 5000 ريال');
        assert.equal(params.currency, 5000);
    });

    it('extracts time period parameter', () => {
        const params = extractParameters('خلال 30 يوم عمل');
        assert.equal(params.timePeriod, 30);
    });

    it('extracts percentage parameter', () => {
        const params = extractParameters('ما يعادل 3% من المبلغ');
        assert.equal(params.percentage, 3);
    });
});

// -----------------------------------------------
// Drift Detector Tests
// -----------------------------------------------
describe('Drift Detector', () => {
    it('detects parameter changes between circular versions', () => {
        const baseline = parseCircular(SAMA_CIRCULAR_AR, { authority: 'SAMA' });
        const updated = parseCircular(SAMA_CIRCULAR_UPDATED, { authority: 'SAMA' });

        const baseObligations = extractObligations(baseline.sections, 'SAMA');
        const newObligations = extractObligations(updated.sections, 'SAMA');

        const drifts = detectDrift(baseObligations, newObligations, 'SAMA');

        assert.ok(drifts.length >= 1, `Expected ≥1 drift alerts, got ${drifts.length}`);

        // Should detect the new Article 9
        const addedDrifts = drifts.filter(d => d.driftType === 'added');
        assert.ok(addedDrifts.length >= 1, 'Should detect at least one new obligation');
    });

    it('calculates Jaccard similarity correctly', () => {
        const setA = new Set(['hello', 'world', 'foo']);
        const setB = new Set(['hello', 'world', 'bar']);
        const score = jaccardSimilarity(setA, setB);
        assert.ok(score > 0.4 && score < 0.6, `Expected ~0.5, got ${score}`);
    });

    it('detects parameter differences', () => {
        const diff = compareParameters(
            { currency: 5000, percentage: 3 },
            { currency: 3000, percentage: 2 }
        );
        assert.ok(diff.currency);
        assert.equal(diff.currency.previous, 5000);
        assert.equal(diff.currency.current, 3000);
        assert.ok(diff.percentage);
    });
});
