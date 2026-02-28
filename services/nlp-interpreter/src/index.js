// ============================================
// SAQR NLP Interpreter — Main Service Entry
// Ingests circulars, extracts obligations,
// detects drift, and feeds Compliance Engine
// ============================================

const { Pool } = require('pg');
const { parseCircular } = require('./regulatory-parser');
const { extractObligations } = require('./obligation-extractor');
const { detectDrift } = require('./drift-detector');

const pool = new Pool({
    host: process.env.SHADOW_DB_HOST || 'localhost',
    port: parseInt(process.env.SHADOW_DB_PORT || '5432', 10),
    database: process.env.SHADOW_DB_NAME || 'saqr_shadow',
    user: process.env.SHADOW_DB_USER || 'saqr',
    password: process.env.SHADOW_DB_PASSWORD || 'saqr_dev_password',
});

// -----------------------------------------------
// Store obligation in DB
// -----------------------------------------------
async function storeObligation(obl, documentId) {
    const query = `
    INSERT INTO shadow.obligations
      (obligation_id, document_id, authority, article, obligation_text,
       obligation_type, parameters, severity, confidence, source_section)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (obligation_id) DO UPDATE SET
      obligation_text = EXCLUDED.obligation_text,
      parameters = EXCLUDED.parameters,
      confidence = EXCLUDED.confidence,
      updated_at = NOW()
    RETURNING id
  `;
    const values = [
        obl.obligationId, documentId, obl.authority, obl.article,
        obl.obligationText, obl.obligationType, JSON.stringify(obl.parameters),
        obl.severity, obl.confidence, obl.sourceSection,
    ];
    return pool.query(query, values);
}

// -----------------------------------------------
// Store drift alert in DB
// -----------------------------------------------
async function storeDriftAlert(alert) {
    const query = `
    INSERT INTO shadow.instruction_drift
      (alert_id, drift_type, authority, severity, title, description,
       previous_obligation, new_obligation, parameter_diff, detected_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (alert_id) DO NOTHING
    RETURNING id
  `;
    const values = [
        alert.alertId, alert.driftType, alert.authority, alert.severity,
        alert.title, alert.description,
        JSON.stringify(alert.previousObligation),
        JSON.stringify(alert.newObligation),
        JSON.stringify(alert.parameterDiff),
        alert.detectedAt,
    ];
    return pool.query(query, values);
}

// -----------------------------------------------
// Ingest a new circular
// -----------------------------------------------
async function ingestCircular(rawText, metadata) {
    console.log(`\n📜 Ingesting circular: ${metadata.title || 'Untitled'}`);

    // Step 1: Parse
    const parsed = parseCircular(rawText, metadata);
    console.log(`   📄 Parsed ${parsed.sections.length} sections (${parsed.language})`);

    // Step 2: Extract obligations
    const obligations = extractObligations(parsed.sections, parsed.authority);
    console.log(`   📋 Extracted ${obligations.length} obligations`);

    // Step 3: Load baseline for drift comparison
    let baseline = [];
    try {
        const result = await pool.query(
            `SELECT obligation_id, authority, article, obligation_text,
              obligation_type, parameters, severity, confidence, source_section
       FROM shadow.obligations
       WHERE authority = $1
       ORDER BY id`,
            [parsed.authority]
        );
        baseline = result.rows.map(r => ({
            obligationId: r.obligation_id,
            authority: r.authority,
            article: r.article,
            obligationText: r.obligation_text,
            obligationType: r.obligation_type,
            parameters: typeof r.parameters === 'string' ? JSON.parse(r.parameters) : r.parameters,
            severity: r.severity,
            confidence: r.confidence,
            sourceSection: r.source_section,
        }));
        console.log(`   📊 Baseline: ${baseline.length} existing obligations`);
    } catch (err) {
        console.log(`   ℹ️  No baseline found (first ingestion): ${err.message}`);
    }

    // Step 4: Detect drift
    const drifts = detectDrift(baseline, obligations, parsed.authority);
    if (drifts.length > 0) {
        console.log(`   ⚠️  INSTRUCTION DRIFT DETECTED: ${drifts.length} alerts`);
        for (const d of drifts) {
            console.log(`      🔄 [${d.severity.toUpperCase()}] ${d.title}`);
            await storeDriftAlert(d);
        }
    } else {
        console.log(`   ✅ No drift detected`);
    }

    // Step 5: Store new obligations (upsert)
    for (const obl of obligations) {
        await storeObligation(obl, parsed.documentId);
    }
    console.log(`   💾 Stored ${obligations.length} obligations`);

    return { parsed, obligations, drifts };
}

// -----------------------------------------------
// Main — Demo ingestion
// -----------------------------------------------
async function main() {
    console.log('');
    console.log('🦅 ============================================');
    console.log('🦅  SAQR NLP INTERPRETER — Starting');
    console.log('🦅  Mode: Rule-Based (Phase A)');
    console.log('🦅  BERT Swap: Ready for Phase B');
    console.log('🦅 ============================================');
    console.log('');

    // Test DB connection
    try {
        await pool.query('SELECT 1');
        console.log('✅ Shadow DB connected');
    } catch (err) {
        console.error('❌ Shadow DB connection failed:', err.message);
        console.log('ℹ️  Run in test-only mode (no DB persistence)');
    }

    // Demo: Ingest sample SAMA circular
    const sampleCircular = `
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

    try {
        await ingestCircular(sampleCircular, {
            authority: 'SAMA',
            title: 'تعميم حماية المستهلك 2026',
            referenceNumber: 'SAMA-CP-2026-001',
            issueDate: '2026-01-15',
        });
    } catch (err) {
        console.log('ℹ️  Demo ingestion (no DB):', err.message);
    }

    console.log('');
    console.log('🦅 NLP Interpreter ready. Awaiting circulars...');
}

module.exports = { ingestCircular };

if (require.main === module) {
    main().catch(console.error);
}
