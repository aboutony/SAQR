const { detect, applyNMS } = require('./detector');
const { createEvidenceRecord, buildMaintenanceAlert } = require('./evidence-bridge');
const { assertProviderContract } = require('../../../shared/provider-contract');

function createRuleBasedDetectionEngine() {
    return {
        detect(frame) {
            const rawDetections = detect(frame.buffer, {
                cameraId: frame.cameraId,
                timestamp: frame.timestamp,
                width: frame.width,
                height: frame.height,
            });

            return applyNMS(rawDetections);
        },
    };
}

function createEvidenceFactory() {
    return {
        create(detection, frame) {
            return createEvidenceRecord(detection, frame);
        },
    };
}

function createMaintenanceNotifier() {
    return {
        notify(evidence) {
            return buildMaintenanceAlert(evidence);
        },
    };
}

function createPostgresCvEvidenceRepository(queryAdapter) {
    assertProviderContract('cv.queryAdapter', queryAdapter, ['query']);

    async function storeDetection(evidence) {
        return queryAdapter.query(
            `INSERT INTO shadow.cv_detections
           (evidence_id, camera_id, source, violation_code, category, confidence,
            bbox, frame_hash, detection_hash, ntp_timestamp, severity,
            name_en, name_ar, record_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (evidence_id) DO NOTHING
         RETURNING id`,
            [
                evidence.evidenceId,
                evidence.cameraId,
                evidence.source,
                evidence.violationCode,
                evidence.category,
                evidence.confidence,
                JSON.stringify(evidence.bbox),
                evidence.frameHash,
                evidence.detectionHash,
                evidence.ntpTimestamp,
                evidence.severity,
                evidence.nameEn,
                evidence.nameAr,
                evidence.recordType,
            ]
        );
    }

    async function sealToVault(evidence) {
        return queryAdapter.query(
            `INSERT INTO vault.evidence
           (evidence_type, source_module, violation_code, authority, severity,
            title, description, raw_payload, sha256_hash, ntp_timestamp)
         VALUES ('visual_audit', 'cv-watchman', $1, 'MOMAH', $2, $3, $4, $5, $6, $7)
         ON CONFLICT (sha256_hash) DO NOTHING`,
            [
                evidence.violationCode,
                evidence.severity,
                evidence.nameEn,
                `Camera: ${evidence.cameraId} | Confidence: ${(evidence.confidence * 100).toFixed(1)}% | Category: ${evidence.category}`,
                JSON.stringify(evidence),
                evidence.detectionHash,
                evidence.ntpTimestamp,
            ]
        );
    }

    return {
        storeDetection,
        sealToVault,
        async record(evidence) {
            await storeDetection(evidence);
            await sealToVault(evidence);
        },
    };
}

function createCvScanFlow({
    frameSource,
    detectionEngine,
    evidenceFactory,
    evidenceRepository,
    maintenanceNotifier,
    logger,
}) {
    const sourceProvider = assertProviderContract('cv.frameSource', frameSource, ['grabAllFrames']);
    const detectorProvider = assertProviderContract('cv.detectionEngine', detectionEngine, ['detect']);
    const evidenceProvider = assertProviderContract('cv.evidenceFactory', evidenceFactory, ['create']);
    const repositoryProvider = assertProviderContract('cv.evidenceRepository', evidenceRepository, ['record']);
    const maintenanceProvider = maintenanceNotifier
        ? assertProviderContract('cv.maintenanceNotifier', maintenanceNotifier, ['notify'])
        : null;

    return async function runScanCycle() {
        const frames = await sourceProvider.grabAllFrames();
        let totalDetections = 0;

        logger.info('cv.scan_cycle.started', {
            cameraCount: frames.length,
        });

        for (const frame of frames) {
            const detections = detectorProvider.detect(frame);

            for (const detection of detections) {
                totalDetections++;
                const evidence = evidenceProvider.create(detection, frame);
                maintenanceProvider?.notify(evidence);

                logger.audit('cv.detection_observed', {
                    cameraId: frame.cameraId,
                    violationCode: detection.violationCode || detection.code,
                    severity: detection.severity,
                    confidence: Number(detection.confidence.toFixed(4)),
                });

                try {
                    await repositoryProvider.record(evidence);
                } catch (error) {
                    logger.error('cv.detection_persistence_failed', error, {
                        cameraId: frame.cameraId,
                        violationCode: detection.violationCode || detection.code,
                    });
                }
            }
        }

        logger.info('cv.scan_cycle.completed', {
            cameraCount: frames.length,
            detectionCount: totalDetections,
        });

        return totalDetections;
    };
}

module.exports = {
    createCvScanFlow,
    createEvidenceFactory,
    createMaintenanceNotifier,
    createPostgresCvEvidenceRepository,
    createRuleBasedDetectionEngine,
};
