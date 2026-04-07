// ============================================
// SAQR CV Watchman — Main Service
// VMS polling → Detection → Evidence → DB
// ============================================

const { Pool } = require('pg');
const { VmsAdapter } = require('./vms/vms-adapter');
const { VIOLATION_CLASSES } = require('./violation-classes');
const { buildCvConfig } = require('./config');
const {
    createCvScanFlow,
    createEvidenceFactory,
    createMaintenanceNotifier,
    createPostgresCvEvidenceRepository,
    createRuleBasedDetectionEngine,
} = require('./cv-flow');
const { createServiceLogger, installProcessHandlers } = require('../../../shared/observability');
const { createPostgresAdapter } = require('../../../shared/postgres-adapter');

const config = buildCvConfig(process.env);
const pool = new Pool(config.db);
const logger = createServiceLogger({ service: 'saqr-cv-watchman', runtime: config.runtime });
const db = createPostgresAdapter(pool, {
    name: 'saqr-cv-watchman-db',
    logger,
});

// Config
const SCAN_INTERVAL_MS = config.cv.scanIntervalMs;
const VMS_TYPE = config.cv.vmsType;

const detectionEngine = createRuleBasedDetectionEngine();
const evidenceFactory = createEvidenceFactory();
const maintenanceNotifier = createMaintenanceNotifier();
const evidenceRepository = createPostgresCvEvidenceRepository(db);

async function runScanCycle(frameSource) {
    const scan = createCvScanFlow({
        frameSource,
        detectionEngine,
        evidenceFactory,
        evidenceRepository,
        maintenanceNotifier,
        logger,
    });

    return scan();
}

// -----------------------------------------------
// Main
// -----------------------------------------------
async function main() {
    config.warnings.forEach((warning) => logger.warn('startup.configuration_warning', { warning }));
    logger.info('service.startup.completed', {
        vmsType: VMS_TYPE,
        scanIntervalMs: SCAN_INTERVAL_MS,
        classCount: VIOLATION_CLASSES.length,
    });

    // Test DB
    try {
        await db.healthcheck();
        logger.info('dependency.shadow_db.connected');
    } catch (err) {
        logger.warn('dependency.shadow_db.unavailable', {
            error: err,
        });
        if (config.startup.validateDbOnStartup) {
            process.exit(1);
        }
    }

    // Init VMS
    const adapter = new VmsAdapter({
        type: VMS_TYPE,
        connection: config.cv.connection,
        logger,
    });
    const connected = await adapter.connect();

    if (!connected) {
        logger.fatal('dependency.vms.failed', new Error('VMS connection failed'));
        process.exit(1);
    }

    const cameras = adapter.getCameras();
    logger.info('dependency.vms.connected', {
        cameraCount: cameras.length,
        cameraIds: cameras.map(camera => camera.id),
    });

    // Run initial scan
    const count = await runScanCycle(adapter);
    logger.info('cv.initial_scan.completed', {
        detectionCount: count,
    });

    // Start polling loop
    logger.info('cv.monitoring.active', {
        intervalSeconds: SCAN_INTERVAL_MS / 1000,
    });
    setInterval(() => {
        runScanCycle(adapter).catch(err => {
            logger.error('cv.scan_cycle.failed', err);
        });
    }, SCAN_INTERVAL_MS);
}

module.exports = {
    runScanCycle,
    storeDetection: evidenceRepository.storeDetection,
};

installProcessHandlers({
    logger,
    onShutdown: async () => {
        await db.close().catch(() => { });
    },
});

if (require.main === module) {
    main().catch((err) => {
        logger.fatal('service.startup.failed', err);
        process.exit(1);
    });
}
