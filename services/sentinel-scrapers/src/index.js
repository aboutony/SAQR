// ============================================
// SAQR Sentinel — Orchestrator
// Runs SAMA + SDAIA scrapers on a 15-minute
// interval and pushes results through the
// Sovereign Bridge into regulatory_staging.
// ============================================

const cron = require('node-cron');
const { chromium } = require('playwright');
const { scrapeSAMA, scrapeSAMADemo } = require('./sama-scraper');
const { scrapeSDAIA, scrapeSDAIADemo } = require('./sdaia-scraper');
const { ingestRules, ingestRulesDemo, closePool } = require('./bridge');

// Mode: 'live' uses Playwright + DB, 'demo' uses mock data + console
const MODE = process.env.SENTINEL_MODE || 'demo';
const CRON_SCHEDULE = process.env.SENTINEL_CRON || '*/15 * * * *'; // Every 15 minutes

/**
 * Execute a full scrape cycle for all authorities.
 */
async function runScrapeSession() {
    const startTime = Date.now();
    console.log('');
    console.log('🦅 ============================================');
    console.log('🦅  SAQR Sentinel — Scrape Session Started');
    console.log(`🦅  Mode: ${MODE.toUpperCase()} | Time: ${new Date().toISOString()}`);
    console.log('🦅 ============================================');

    let samaResults = [];
    let sdaiaResults = [];

    if (MODE === 'live') {
        // Launch headless Chromium
        let browser;
        try {
            browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });

            // Run scrapers in parallel
            [samaResults, sdaiaResults] = await Promise.all([
                scrapeSAMA(browser),
                scrapeSDAIA(browser),
            ]);
        } catch (err) {
            console.error(`[SENTINEL] Browser launch error: ${err.message}`);
        } finally {
            if (browser) await browser.close().catch(() => { });
        }

        // Push through Sovereign Bridge
        const allRules = [...samaResults, ...sdaiaResults];
        await ingestRules(allRules);
    } else {
        // Demo mode — no network, no DB
        samaResults = scrapeSAMADemo();
        sdaiaResults = scrapeSDAIADemo();

        const allRules = [...samaResults, ...sdaiaResults];
        ingestRulesDemo(allRules);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log(`🦅  Session complete in ${elapsed}s`);
    console.log(`🦅  SAMA: ${samaResults.length} entries | SDAIA: ${sdaiaResults.length} entries`);
    console.log('🦅 ============================================');
    console.log('');
}

// -----------------------------------------------
// Scheduler
// -----------------------------------------------
function startScheduler() {
    console.log('');
    console.log('🦅 ============================================');
    console.log('🦅  SAQR Sentinel Engine v1.0');
    console.log(`🦅  Mode: ${MODE.toUpperCase()}`);
    console.log(`🦅  Schedule: ${CRON_SCHEDULE}`);
    console.log('🦅  Authorities: SAMA, SDAIA');
    console.log('🦅  Bridge: Sovereign Bridge (One-Way Encrypted)');
    console.log('🦅 ============================================');
    console.log('');

    // Run immediately on startup
    runScrapeSession();

    // Schedule recurring runs
    cron.schedule(CRON_SCHEDULE, () => {
        runScrapeSession();
    });

    console.log(`[SENTINEL] Scheduler active — next run in 15 minutes`);
}

// -----------------------------------------------
// Graceful Shutdown
// -----------------------------------------------
process.on('SIGINT', async () => {
    console.log('\n[SENTINEL] Shutting down gracefully...');
    if (MODE === 'live') await closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n[SENTINEL] Terminated — closing connections...');
    if (MODE === 'live') await closePool();
    process.exit(0);
});

// -----------------------------------------------
// Main
// -----------------------------------------------
startScheduler();
