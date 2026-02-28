// ============================================
// SAQR CV Watchman — Evidence Bridge
// Sends detected violations to the Visual Locker
// for SHA-256 hashing and NTP timestamping
// ============================================

const crypto = require('crypto');

/**
 * @typedef {object} VisualEvidence
 * @property {string} evidenceId
 * @property {string} cameraId
 * @property {string} source - VMS type
 * @property {string} violationCode
 * @property {string} category
 * @property {number} confidence
 * @property {object} bbox
 * @property {string} frameHash - SHA-256 of the raw frame
 * @property {string} detectionHash - SHA-256 of the full detection payload
 * @property {string} ntpTimestamp
 * @property {string} severity
 * @property {string} nameEn
 * @property {string} nameAr
 * @property {string} recordType - 'before' | 'after' | 'live'
 */

/**
 * Hash a raw frame buffer with SHA-256.
 * @param {Buffer} frameBuffer
 * @returns {string} 64-char hex hash
 */
function hashFrame(frameBuffer) {
    return crypto.createHash('sha256').update(frameBuffer).digest('hex');
}

/**
 * Create a full detection evidence record.
 * Performs SHA-256 hashing + NTP timestamping.
 *
 * @param {import('./detector').Detection} detection
 * @param {object} frame - { buffer, timestamp, cameraId, source }
 * @returns {VisualEvidence}
 */
function createEvidenceRecord(detection, frame) {
    const frameHash = hashFrame(frame.buffer);
    const ntpTimestamp = frame.timestamp || new Date().toISOString();

    // Build canonical payload for detection hash
    const payload = {
        cameraId: frame.cameraId,
        source: frame.source,
        violationCode: detection.code,
        classId: detection.classId,
        confidence: detection.confidence,
        bbox: detection.bbox,
        frameHash,
        ntpTimestamp,
    };

    const detectionHash = crypto.createHash('sha256')
        .update(JSON.stringify(payload, Object.keys(payload).sort()))
        .digest('hex');

    return {
        evidenceId: `CVE-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        cameraId: frame.cameraId,
        source: frame.source,
        violationCode: detection.code,
        category: detection.category,
        confidence: detection.confidence,
        bbox: detection.bbox,
        frameHash,
        detectionHash,
        ntpTimestamp,
        severity: detection.severity,
        nameEn: detection.nameEn,
        nameAr: detection.nameAr,
        recordType: 'before', // "Before" record for objection defense
    };
}

/**
 * Verify the integrity of an evidence record.
 * @param {VisualEvidence} record
 * @returns {boolean}
 */
function verifyEvidenceRecord(record) {
    const payload = {
        cameraId: record.cameraId,
        source: record.source,
        violationCode: record.violationCode,
        classId: undefined, // not stored in evidence record
        confidence: record.confidence,
        bbox: record.bbox,
        frameHash: record.frameHash,
        ntpTimestamp: record.ntpTimestamp,
    };

    const recomputedHash = crypto.createHash('sha256')
        .update(JSON.stringify(payload, Object.keys(payload).sort()))
        .digest('hex');

    return recomputedHash === record.detectionHash;
}

/**
 * Build a maintenance alert from a detection.
 * @param {VisualEvidence} evidence
 * @returns {object} Maintenance alert for dashboard
 */
function buildMaintenanceAlert(evidence) {
    return {
        alertId: `MAINT-${Date.now()}`,
        alertType: 'maintenance',
        violationCode: evidence.violationCode,
        severity: evidence.severity,
        titleEn: `Maintenance Alert: ${evidence.nameEn}`,
        titleAr: `تنبيه صيانة: ${evidence.nameAr}`,
        descriptionEn: `CV detection on camera ${evidence.cameraId} — ${evidence.nameEn} (${(evidence.confidence * 100).toFixed(1)}% confidence)`,
        descriptionAr: `كشف بصري على كاميرا ${evidence.cameraId} — ${evidence.nameAr} (ثقة ${(evidence.confidence * 100).toFixed(1)}%)`,
        cameraId: evidence.cameraId,
        frameHash: evidence.frameHash,
        detectionHash: evidence.detectionHash,
        timestamp: evidence.ntpTimestamp,
        category: evidence.category,
        recordType: evidence.recordType,
    };
}

module.exports = {
    hashFrame,
    createEvidenceRecord,
    verifyEvidenceRecord,
    buildMaintenanceAlert,
};
