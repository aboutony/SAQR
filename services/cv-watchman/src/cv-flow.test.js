const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createCvScanFlow } = require('./cv-flow');

function createLogger() {
    const events = [];

    return {
        events,
        info(event, fields = {}) {
            events.push({ level: 'info', event, fields });
        },
        warn(event, fields = {}) {
            events.push({ level: 'warn', event, fields });
        },
        audit(event, fields = {}) {
            events.push({ level: 'audit', event, fields });
        },
        error(event, error, fields = {}) {
            events.push({ level: 'error', event, error, fields });
        },
    };
}

describe('CV provider contracts', () => {
    it('rejects detection engines that do not implement detect()', () => {
        const logger = createLogger();

        assert.throws(
            () => createCvScanFlow({
                frameSource: { async grabAllFrames() { return []; } },
                detectionEngine: {},
                evidenceFactory: { create() { return {}; } },
                evidenceRepository: { async record() { } },
                maintenanceNotifier: { notify() { } },
                logger,
            }),
            /detect/
        );
    });

    it('runs the scan flow through provider interfaces', async () => {
        const logger = createLogger();
        const persistedEvidence = [];
        let maintenanceCount = 0;

        const runScanCycle = createCvScanFlow({
            frameSource: {
                async grabAllFrames() {
                    return [
                        {
                            cameraId: 'CAM-1',
                            timestamp: '2026-04-07T09:00:00.000Z',
                            source: 'demo',
                            width: 1920,
                            height: 1080,
                            buffer: Buffer.from('frame-1'),
                        },
                    ];
                },
            },
            detectionEngine: {
                detect() {
                    return [
                        { code: 'MOMAH-CV-001', severity: 'critical', confidence: 0.95 },
                        { code: 'MOMAH-CV-002', severity: 'high', confidence: 0.81 },
                    ];
                },
            },
            evidenceFactory: {
                create(detection, frame) {
                    return {
                        evidenceId: `${frame.cameraId}-${detection.code}`,
                        cameraId: frame.cameraId,
                        violationCode: detection.code,
                        severity: detection.severity,
                        confidence: detection.confidence,
                        category: 'signage',
                        bbox: { x: 1, y: 2, width: 3, height: 4 },
                        frameHash: 'frame-hash',
                        detectionHash: `${detection.code}-hash`,
                        ntpTimestamp: frame.timestamp,
                        nameEn: 'Sample',
                        nameAr: 'Sample',
                        recordType: 'before',
                        source: frame.source,
                    };
                },
            },
            evidenceRepository: {
                async record(evidence) {
                    persistedEvidence.push(evidence);
                },
            },
            maintenanceNotifier: {
                notify() {
                    maintenanceCount++;
                },
            },
            logger,
        });

        const detectionCount = await runScanCycle();

        assert.equal(detectionCount, 2);
        assert.equal(persistedEvidence.length, 2);
        assert.equal(maintenanceCount, 2);
        assert.ok(logger.events.some((entry) => entry.event === 'cv.scan_cycle.completed'));
    });
});
