// ============================================
// SAQR Sentinel - Orchestrator
// Runs registered authority providers on a
// schedule and pushes results through the
// Sovereign Bridge into regulatory_staging.
// ============================================

const cron = require('node-cron');
const { chromium } = require('playwright');
const { ingestRules, ingestRulesDemo, closePool, testBridgeConnection } = require('./bridge');
const {
    createDefaultRegulatorySourceRegistry,
    createRegulatorySourceOrchestrator,
    resolveRegulatorySources,
} = require('./source-adapters');
const { buildSentinelConfig } = require('./config');
const { createServiceLogger, installProcessHandlers } = require('../../../shared/observability');

const config = buildSentinelConfig(process.env);
const MODE = config.mode;
const CRON_SCHEDULE = config.schedule;
const logger = createServiceLogger({ service: 'saqr-sentinel', runtime: config.runtime });
const sourceOrchestrator = createRegulatorySourceOrchestrator({
    sources: resolveRegulatorySources(config.authorities, createDefaultRegulatorySourceRegistry()),
    logger,
});

async function runScrapeSession() {
    const startTime = Date.now();
    config.warnings.forEach((warning) => logger.warn('startup.configuration_warning', { warning }));
    logger.info('scrape.session.started', {
        mode: MODE,
        authorities: config.authorities,
    });

    let samaResults = [];
    let sdaiaResults = [];
    let allRules = [];
    let browser;

    if (MODE === 'live') {
        try {
            browser = await chromium.launch({
                headless: config.browser.headless,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
        } catch (err) {
            logger.error('scrape.session.browser_launch_failed', err, {
                mode: MODE,
            });
        }
    }

    try {
        const results = await sourceOrchestrator.run({
            mode: MODE,
            browser,
        });

        samaResults = results.byAuthority.SAMA || [];
        sdaiaResults = results.byAuthority.SDAIA || [];
        allRules = results.entries;
    } finally {
        if (browser) await browser.close().catch(() => { });
    }

    if (MODE === 'live') {
        await ingestRules(allRules);
    } else {
        ingestRulesDemo(allRules);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.audit('sources.scrape_session_completed', {
        mode: MODE,
        durationSeconds: Number(elapsed),
        samaEntries: samaResults.length,
        sdaiaEntries: sdaiaResults.length,
        totalEntries: allRules.length,
    });
}

async function startScheduler() {
    config.warnings.forEach((warning) => logger.warn('startup.configuration_warning', { warning }));
    logger.info('service.startup.completed', {
        mode: MODE,
        schedule: CRON_SCHEDULE,
        authorities: config.authorities,
        bridgeDbValidation: config.bridge.validateDbOnStartup,
    });

    if (MODE === 'live' && config.bridge.validateDbOnStartup) {
        try {
            await testBridgeConnection();
            logger.info('dependency.bridge_db.connected');
        } catch (err) {
            logger.fatal('dependency.bridge_db.failed', err);
            process.exit(1);
        }
    }

    await runScrapeSession();

    cron.schedule(CRON_SCHEDULE, () => {
        runScrapeSession().catch(err => {
            logger.error('scrape.session.failed', err, {
                mode: MODE,
            });
        });
    });

    logger.info('scheduler.active', {
        schedule: CRON_SCHEDULE,
    });
}

installProcessHandlers({
    logger,
    onShutdown: async () => {
        if (MODE === 'live') {
            await closePool();
        }
    },
});

startScheduler().catch(err => {
    logger.fatal('service.startup.failed', err);
    process.exit(1);
});
