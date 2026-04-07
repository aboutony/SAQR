// ============================================
// SAQR NLP Interpreter — Main Service Entry
// Ingests circulars, extracts obligations,
// detects drift, and feeds Compliance Engine
// ============================================

const { Pool } = require('pg');
const { buildNlpConfig } = require('./config');
const {
    createNlpIngestionFlow,
    createPostgresNlpRepository,
    createRuleBasedNlpProviders,
} = require('./nlp-flow');
const { createServiceLogger, installProcessHandlers } = require('../../../shared/observability');
const { createPostgresAdapter } = require('../../../shared/postgres-adapter');

const config = buildNlpConfig(process.env);
const pool = new Pool(config.db);
const logger = createServiceLogger({ service: 'saqr-nlp-interpreter', runtime: config.runtime });
const db = createPostgresAdapter(pool, {
    name: 'saqr-nlp-interpreter-db',
    logger,
});
const { parser, obligationExtractor, driftDetector } = createRuleBasedNlpProviders();
const repository = createPostgresNlpRepository(db);
const ingestCircular = createNlpIngestionFlow({
    parser,
    obligationExtractor,
    driftDetector,
    repository,
    logger,
});

// -----------------------------------------------
// Main — Demo ingestion
// -----------------------------------------------
async function main() {
    config.warnings.forEach((warning) => logger.warn('startup.configuration_warning', { warning }));
    logger.info('service.startup.completed', {
        bootMode: config.nlp.bootMode,
        startupDbValidation: config.startup.validateDbOnStartup,
        pipeline: 'phase-a-rule-engine',
    });

    // Test DB connection
    try {
        await db.healthcheck();
        logger.info('dependency.shadow_db.connected');
    } catch (err) {
        logger.error('dependency.shadow_db.failed', err, {
            startupValidationRequired: config.startup.validateDbOnStartup,
        });
        if (config.startup.validateDbOnStartup) {
            process.exit(1);
        }
        logger.warn('dependency.shadow_db.deferred_validation', {
            message: 'Run in test-only mode (no DB persistence)',
        });
    }

    if (config.nlp.bootMode !== 'demo-ingest') {
        logger.info('service.ready', {
            mode: 'service',
            awaiting: 'regulatory_circulars',
            demoIngestionSkipped: true,
        });
        return;
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
        logger.warn('nlp.demo_ingestion.failed', {
            error: err,
        });
    }

    logger.info('service.ready', {
        mode: 'demo-ingest',
        awaiting: 'regulatory_circulars',
    });
}

module.exports = { ingestCircular };

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
