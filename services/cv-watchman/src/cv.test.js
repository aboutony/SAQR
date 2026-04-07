// ============================================
// SAQR CV Watchman — Unit Tests
// ============================================

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { detect, applyNMS, computeIoU } = require('./detector');
const { VIOLATION_CLASSES, getClassById, getClassByCode, getClassesByCategory } = require('./violation-classes');
const { hashFrame, createEvidenceRecord, verifyEvidenceRecord, buildMaintenanceAlert } = require('./evidence-bridge');
const { VmsAdapter, DemoVmsClient } = require('./vms/vms-adapter');

// -----------------------------------------------
// Violation Classes
// -----------------------------------------------
describe('Violation Classes', () => {
    it('defines exactly 9 MOMAH categories', () => {
        assert.equal(VIOLATION_CLASSES.length, 9);
    });

    it('has 3 categories: signage, visual, structural', () => {
        const categories = new Set(VIOLATION_CLASSES.map(c => c.category));
        assert.deepStrictEqual(categories, new Set(['signage', 'visual', 'structural']));
    });

    it('all classes have bilingual names', () => {
        for (const cls of VIOLATION_CLASSES) {
            assert.ok(cls.nameEn, `Missing nameEn for ${cls.code}`);
            assert.ok(cls.nameAr, `Missing nameAr for ${cls.code}`);
        }
    });

    it('lookup by ID works', () => {
        const cls = getClassById(0);
        assert.equal(cls.code, 'MOMAH-CV-001');
    });

    it('lookup by code works', () => {
        const cls = getClassByCode('MOMAH-CV-007');
        assert.equal(cls.nameEn, 'Unauthorized Partitioning');
        assert.equal(cls.severity, 'critical');
    });

    it('category filter works', () => {
        const signage = getClassesByCategory('signage');
        assert.equal(signage.length, 3);
        const structural = getClassesByCategory('structural');
        assert.equal(structural.length, 3);
    });
});

// -----------------------------------------------
// VMS Adapter
// -----------------------------------------------
describe('VMS Adapter — Demo Mode', () => {
    it('creates demo adapter with 5 cameras', async () => {
        const adapter = new VmsAdapter({ type: 'demo' });
        await adapter.connect();
        const cameras = adapter.getCameras();
        assert.equal(cameras.length, 5);
    });

    it('grabs frames from demo cameras', async () => {
        const adapter = new VmsAdapter({ type: 'demo' });
        await adapter.connect();
        const frames = await adapter.grabAllFrames();
        assert.ok(frames.length > 0, 'Should grab at least 1 frame');
        assert.ok(frames[0].buffer instanceof Buffer);
        assert.ok(frames[0].timestamp);
        assert.ok(frames[0].cameraId);
    });

    it('rate limits frame grabs (1 fps)', async () => {
        const client = new DemoVmsClient();
        const frame1 = await client.grabFrame('CAM-01');
        const frame2 = await client.grabFrame('CAM-01'); // Immediate retry
        assert.ok(frame1, 'First grab should succeed');
        assert.equal(frame2, null, 'Second grab should be rate-limited');
    });

    it('accepts a delivery-team supplied provider registry', async () => {
        const adapter = new VmsAdapter({
            type: 'custom-vendor',
            registry: {
                'custom-vendor': () => ({
                    async authenticate() {
                        return true;
                    },
                    async getCameras() {
                        return [{ id: 'CUSTOM-01', name: 'Custom Camera', enabled: true }];
                    },
                    async grabFrame(cameraId) {
                        return {
                            buffer: Buffer.from('custom-frame'),
                            timestamp: new Date().toISOString(),
                            cameraId,
                            source: 'custom-vendor',
                            width: 1280,
                            height: 720,
                        };
                    },
                    async getStatus() {
                        return 'connected';
                    },
                }),
            },
        });

        const connected = await adapter.connect();
        assert.equal(connected, true);
        assert.equal(adapter.getCameras().length, 1);
        assert.equal(adapter.getCameras()[0].id, 'CUSTOM-01');
    });
});

// -----------------------------------------------
// Detector
// -----------------------------------------------
describe('Detector', () => {
    it('produces detections from valid frame', () => {
        // Search deterministic frame payloads until one produces a detection.
        let frame = null;
        const meta = { cameraId: 'TEST-01', timestamp: new Date().toISOString(), width: 1920, height: 1080 };

        for (let i = 0; i < 1000; i++) {
            const buf = Buffer.from(`TEST-FRAME-${i}-VIOLATION`);
            const dets = detect(buf, meta);
            if (dets.length > 0) {
                frame = { buffer: buf, detections: dets };
                break;
            }
        }

        assert.ok(frame, 'At least one deterministic frame should produce a detection within 1000 tries');
        assert.ok(frame.detections[0].code.startsWith('MOMAH-CV-'));
        assert.ok(frame.detections[0].confidence > 0);
        assert.ok(frame.detections[0].bbox);
        assert.ok(frame.detections[0].bbox.x >= 0 && frame.detections[0].bbox.x <= 1);
    });

    it('returns empty array for empty buffer', () => {
        const result = detect(Buffer.alloc(0), {});
        assert.deepStrictEqual(result, []);
    });

    it('detection has all required fields', () => {
        for (let i = 0; i < 50; i++) {
            const buf = Buffer.from(`FIELD-CHECK-${i}`);
            const dets = detect(buf, { cameraId: 'TEST' });
            for (const d of dets) {
                assert.ok(d.classId !== undefined, 'classId missing');
                assert.ok(d.code, 'code missing');
                assert.ok(d.nameEn, 'nameEn missing');
                assert.ok(d.nameAr, 'nameAr missing');
                assert.ok(d.category, 'category missing');
                assert.ok(typeof d.confidence === 'number', 'confidence not a number');
                assert.ok(d.bbox, 'bbox missing');
                assert.ok(d.severity, 'severity missing');
            }
        }
    });
});

// -----------------------------------------------
// IoU and NMS
// -----------------------------------------------
describe('NMS / IoU', () => {
    it('computes IoU ≈ 1.0 for identical boxes', () => {
        const box = { x: 0.1, y: 0.1, width: 0.4, height: 0.3 };
        const iou = computeIoU(box, box);
        assert.ok(Math.abs(iou - 1.0) < 0.001, `Expected ~1.0, got ${iou}`);
    });

    it('computes IoU = 0.0 for non-overlapping boxes', () => {
        const a = { x: 0, y: 0, width: 0.2, height: 0.2 };
        const b = { x: 0.5, y: 0.5, width: 0.2, height: 0.2 };
        assert.equal(computeIoU(a, b), 0);
    });

    it('NMS keeps higher-confidence detection', () => {
        const dets = [
            { classId: 0, code: 'A', confidence: 0.9, bbox: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 } },
            { classId: 0, code: 'A', confidence: 0.7, bbox: { x: 0.12, y: 0.12, width: 0.3, height: 0.3 } },
        ];
        const result = applyNMS(dets, 0.5);
        assert.equal(result.length, 1);
        assert.equal(result[0].confidence, 0.9);
    });

    it('NMS keeps non-overlapping detections', () => {
        const dets = [
            { classId: 0, code: 'A', confidence: 0.9, bbox: { x: 0, y: 0, width: 0.2, height: 0.2 } },
            { classId: 1, code: 'B', confidence: 0.8, bbox: { x: 0.5, y: 0.5, width: 0.2, height: 0.2 } },
        ];
        const result = applyNMS(dets, 0.5);
        assert.equal(result.length, 2);
    });
});

// -----------------------------------------------
// Evidence Bridge
// -----------------------------------------------
describe('Evidence Bridge', () => {
    it('hashes frame buffer to 64-char hex', () => {
        const buf = Buffer.from('test-frame-data');
        const hash = hashFrame(buf);
        assert.equal(hash.length, 64);
        assert.match(hash, /^[a-f0-9]{64}$/);
    });

    it('creates evidence record with all fields', () => {
        const detection = {
            classId: 0, code: 'MOMAH-CV-001', nameEn: 'Burnt-Out Signage',
            nameAr: 'لوحة إعلانية محترقة', category: 'signage',
            confidence: 0.85, bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
            severity: 'high',
        };
        const frame = {
            buffer: Buffer.from('evidence-frame'),
            timestamp: '2026-02-28T04:00:00.000Z',
            cameraId: 'CAM-01',
            source: 'demo',
        };

        const record = createEvidenceRecord(detection, frame);
        assert.ok(record.evidenceId.startsWith('CVE-'));
        assert.equal(record.cameraId, 'CAM-01');
        assert.equal(record.violationCode, 'MOMAH-CV-001');
        assert.equal(record.frameHash.length, 64);
        assert.equal(record.detectionHash.length, 64);
        assert.equal(record.recordType, 'before');
        assert.equal(record.severity, 'high');
    });

    it('generates different hashes for different frames', () => {
        const det = { classId: 0, code: 'X', confidence: 0.8, bbox: {}, severity: 'high', nameEn: '', nameAr: '', category: '' };
        const f1 = { buffer: Buffer.from('frame-1'), timestamp: new Date().toISOString(), cameraId: 'C1', source: 'demo' };
        const f2 = { buffer: Buffer.from('frame-2'), timestamp: new Date().toISOString(), cameraId: 'C1', source: 'demo' };

        const r1 = createEvidenceRecord(det, f1);
        const r2 = createEvidenceRecord(det, f2);
        assert.notEqual(r1.frameHash, r2.frameHash);
    });

    it('builds maintenance alert with bilingual fields', () => {
        const evidence = {
            evidenceId: 'CVE-123', cameraId: 'CAM-01', source: 'demo',
            violationCode: 'MOMAH-CV-001', category: 'signage',
            confidence: 0.85, bbox: {}, frameHash: 'abc', detectionHash: 'def',
            ntpTimestamp: '2026-02-28T04:00:00Z', severity: 'high',
            nameEn: 'Burnt-Out Signage', nameAr: 'لوحة إعلانية محترقة',
            recordType: 'before',
        };

        const alert = buildMaintenanceAlert(evidence);
        assert.ok(alert.alertId.startsWith('MAINT-'));
        assert.ok(alert.titleEn.includes('Burnt-Out Signage'));
        assert.ok(alert.titleAr.includes('لوحة إعلانية محترقة'));
        assert.equal(alert.alertType, 'maintenance');
    });
});
