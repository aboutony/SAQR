// ============================================
// SAQR CV Watchman — Main Service
// VMS polling → Detection → Evidence → DB
// ============================================

const { Pool } = require('pg');
const { VmsAdapter } = require('./vms/vms-adapter');
const { detect, applyNMS } = require('./detector');
const { createEvidenceRecord, buildMaintenanceAlert } = require('./evidence-bridge');
const { VIOLATION_CLASSES } = require('./violation-classes');

const pool = new Pool({
    host: process.env.SHADOW_DB_HOST || 'localhost',
    port: parseInt(process.env.SHADOW_DB_PORT || '5432', 10),
    database: process.env.SHADOW_DB_NAME || 'saqr_shadow',
    user: process.env.SHADOW_DB_USER || 'saqr',
    password: process.env.SHADOW_DB_PASSWORD || 'saqr_dev_password',
});

// Config
const SCAN_INTERVAL_MS = parseInt(process.env.CV_SCAN_INTERVAL || '5000', 10);
const VMS_TYPE = process.env.VMS_TYPE || 'demo';

// -----------------------------------------------
// Store detection in DB
// -----------------------------------------------
async function storeDetection(evidence) {
    const query = `
    INSERT INTO shadow.cv_detections
      (evidence_id, camera_id, source, violation_code, category, confidence,
       bbox, frame_hash, detection_hash, ntp_timestamp, severity,
       name_en, name_ar, record_type)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (evidence_id) DO NOTHING
    RETURNING id
  `;
    return pool.query(query, [
        evidence.evidenceId, evidence.cameraId, evidence.source,
        evidence.violationCode, evidence.category, evidence.confidence,
        JSON.stringify(evidence.bbox), evidence.frameHash, evidence.detectionHash,
        evidence.ntpTimestamp, evidence.severity, evidence.nameEn,
        evidence.nameAr, evidence.recordType,
    ]);
}

/**
 * Also create evidence in vault for legal chain
 */
async function sealToVault(evidence) {
    const query = `
    INSERT INTO vault.evidence
      (evidence_type, source_module, violation_code, authority, severity,
       title, description, raw_payload, sha256_hash, ntp_timestamp)
    VALUES ('visual_audit', 'cv-watchman', $1, 'MOMAH', $2, $3, $4, $5, $6, $7)
    ON CONFLICT (sha256_hash) DO NOTHING
  `;
    return pool.query(query, [
        evidence.violationCode, evidence.severity,
        evidence.nameEn,
        `Camera: ${evidence.cameraId} | Confidence: ${(evidence.confidence * 100).toFixed(1)}% | Category: ${evidence.category}`,
        JSON.stringify(evidence),
        evidence.detectionHash,
        evidence.ntpTimestamp,
    ]);
}

// -----------------------------------------------
// Main scan loop
// -----------------------------------------------
async function runScanCycle(adapter) {
    const frames = await adapter.grabAllFrames();
    let totalDetections = 0;

    for (const frame of frames) {
        // Run detection
        const rawDetections = detect(frame.buffer, {
            cameraId: frame.cameraId,
            timestamp: frame.timestamp,
            width: frame.width,
            height: frame.height,
        });

        // Apply NMS
        const detections = applyNMS(rawDetections);

        for (const det of detections) {
            totalDetections++;
            const evidence = createEvidenceRecord(det, frame);
            const alert = buildMaintenanceAlert(evidence);

            console.log(`   🚨 [${det.severity.toUpperCase()}] ${det.nameEn} — Camera: ${frame.cameraId} (${(det.confidence * 100).toFixed(1)}%)`);

            try {
                await storeDetection(evidence);
                await sealToVault(evidence);
            } catch (err) {
                console.warn(`   ⚠️  DB store failed: ${err.message}`);
            }
        }
    }

    return totalDetections;
}

// -----------------------------------------------
// Main
// -----------------------------------------------
async function main() {
    console.log('');
    console.log('🦅 ============================================');
    console.log('🦅  SAQR CV WATCHMAN — Edge Compliance');
    console.log(`🦅  VMS: ${VMS_TYPE.toUpperCase()}`);
    console.log(`🦅  Scan Interval: ${SCAN_INTERVAL_MS}ms`);
    console.log(`🦅  Classes: ${VIOLATION_CLASSES.length} MOMAH categories`);
    console.log('🦅 ============================================');
    console.log('');

    // Test DB
    try {
        await pool.query('SELECT 1');
        console.log('✅ Shadow DB connected');
    } catch (err) {
        console.warn('⚠️  Shadow DB not available:', err.message);
    }

    // Init VMS
    const adapter = new VmsAdapter({ type: VMS_TYPE });
    const connected = await adapter.connect();

    if (!connected) {
        console.error('❌ VMS connection failed. Exiting.');
        process.exit(1);
    }

    const cameras = adapter.getCameras();
    console.log('');
    console.log('📹 Registered cameras:');
    cameras.forEach(c => console.log(`   ${c.id}: ${c.name}`));
    console.log('');

    // Run initial scan
    console.log('🔍 Running initial scan...');
    const count = await runScanCycle(adapter);
    console.log(`   ✅ Initial scan complete: ${count} detections`);

    // Start polling loop
    console.log(`\n👁️  Starting continuous monitoring (every ${SCAN_INTERVAL_MS / 1000}s)...\n`);
    setInterval(() => runScanCycle(adapter), SCAN_INTERVAL_MS);
}

module.exports = { runScanCycle, storeDetection };

if (require.main === module) {
    main().catch(console.error);
}
