// ============================================
// SAQR CV Watchman — YOLOv8 Detection Engine
// Phase A: Simulated inference (same interface)
// Phase B: ONNX Runtime / TensorRT swap
// ============================================

const { VIOLATION_CLASSES, getClassById } = require('./violation-classes');

/**
 * @typedef {object} Detection
 * @property {number} classId - YOLO class index
 * @property {string} code - MOMAH violation code
 * @property {string} nameEn - English label
 * @property {string} nameAr - Arabic label
 * @property {string} category - signage | visual | structural
 * @property {number} confidence - 0.0 - 1.0
 * @property {object} bbox - { x, y, width, height } normalized 0-1
 * @property {string} severity
 */

/**
 * Run detection on a frame buffer.
 * YOLOv8-compatible interface for zero-code swap.
 *
 * Phase A: Rule-based simulation using frame metadata
 * Phase B: Replace with ONNX Runtime inference
 *
 * @param {Buffer} frameBuffer - Raw frame data
 * @param {object} metadata - { cameraId, timestamp, width, height }
 * @returns {Detection[]}
 */
function detect(frameBuffer, metadata = {}) {
    // Phase A: Simulated detection based on deterministic
    // hashing of frame content (ensures reproducible results)
    return _simulatedDetect(frameBuffer, metadata);
}

/**
 * Simulated detection for Phase A.
 * Uses frame buffer hash to deterministically "detect" violations
 * from each camera at realistic intervals.
 * @private
 */
function _simulatedDetect(frameBuffer, metadata) {
    const detections = [];
    if (!frameBuffer || frameBuffer.length === 0) return detections;

    // Derive a deterministic seed from frame content
    const seed = frameBuffer.reduce((acc, byte, i) => acc + byte * (i + 1), 0);
    const cameraId = metadata.cameraId || 'unknown';

    // Simulate detection probability based on camera + time
    // In production, this is replaced entirely by model inference
    const rand = (seed % 1000) / 1000;
    const detectionRate = 0.35; // ~35% of frames contain a violation

    if (rand > detectionRate) return detections;

    // Pick violation class based on camera type + seed
    const classIndex = seed % VIOLATION_CLASSES.length;
    const violationClass = VIOLATION_CLASSES[classIndex];
    if (!violationClass) return detections;

    // Generate realistic confidence score
    const baseConfidence = 0.60 + (seed % 30) / 100;
    const confidence = Math.min(baseConfidence, 0.98);

    // Only flag if above class threshold
    if (confidence < violationClass.confidenceThreshold) return detections;

    // Generate realistic bounding box
    const bboxSeed = (seed * 7) % 100;
    const bbox = {
        x: 0.1 + (bboxSeed % 60) / 100,
        y: 0.1 + ((bboxSeed * 3) % 50) / 100,
        width: 0.15 + (bboxSeed % 20) / 100,
        height: 0.1 + ((bboxSeed * 2) % 25) / 100,
    };

    detections.push({
        classId: violationClass.id,
        code: violationClass.code,
        nameEn: violationClass.nameEn,
        nameAr: violationClass.nameAr,
        category: violationClass.category,
        confidence: parseFloat(confidence.toFixed(3)),
        bbox,
        severity: violationClass.severity,
    });

    // Occasionally detect multiple violations (10% chance)
    if ((seed % 10) === 0 && VIOLATION_CLASSES.length > 1) {
        const secondClass = VIOLATION_CLASSES[(classIndex + 3) % VIOLATION_CLASSES.length];
        const conf2 = 0.55 + (seed % 25) / 100;
        if (conf2 >= secondClass.confidenceThreshold) {
            detections.push({
                classId: secondClass.id,
                code: secondClass.code,
                nameEn: secondClass.nameEn,
                nameAr: secondClass.nameAr,
                category: secondClass.category,
                confidence: parseFloat(conf2.toFixed(3)),
                bbox: {
                    x: bbox.x + 0.3,
                    y: bbox.y + 0.2,
                    width: 0.12,
                    height: 0.15,
                },
                severity: secondClass.severity,
            });
        }
    }

    return detections;
}

/**
 * Apply Non-Maximum Suppression to filter overlapping boxes.
 * @param {Detection[]} detections
 * @param {number} iouThreshold - IoU threshold (default 0.5)
 * @returns {Detection[]}
 */
function applyNMS(detections, iouThreshold = 0.5) {
    if (detections.length <= 1) return detections;

    // Sort by confidence descending
    const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
    const kept = [];

    for (const det of sorted) {
        let dominated = false;
        for (const keptDet of kept) {
            if (computeIoU(det.bbox, keptDet.bbox) > iouThreshold) {
                dominated = true;
                break;
            }
        }
        if (!dominated) kept.push(det);
    }

    return kept;
}

/**
 * Compute Intersection over Union between two bounding boxes.
 */
function computeIoU(boxA, boxB) {
    const ax1 = boxA.x, ay1 = boxA.y;
    const ax2 = boxA.x + boxA.width, ay2 = boxA.y + boxA.height;
    const bx1 = boxB.x, by1 = boxB.y;
    const bx2 = boxB.x + boxB.width, by2 = boxB.y + boxB.height;

    const interX1 = Math.max(ax1, bx1);
    const interY1 = Math.max(ay1, by1);
    const interX2 = Math.min(ax2, bx2);
    const interY2 = Math.min(ay2, by2);

    const interArea = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1);
    const areaA = boxA.width * boxA.height;
    const areaB = boxB.width * boxB.height;
    const unionArea = areaA + areaB - interArea;

    return unionArea === 0 ? 0 : interArea / unionArea;
}

module.exports = { detect, applyNMS, computeIoU };
