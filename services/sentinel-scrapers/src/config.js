const {
    resolveRuntimeProfile,
    assertNoDemoModeInProduction,
    envFlag,
} = require('../../../shared/runtime-profile');
const {
    buildDbConfig,
    assertCronExpression,
    assertOneOf,
} = require('../../../shared/service-config');

const SUPPORTED_MODES = ['demo', 'live'];
const AUTHORITIES = ['SAMA', 'SDAIA'];

function buildSentinelConfig(env = process.env) {
    const runtime = resolveRuntimeProfile(env, 'saqr-sentinel');
    const mode = String(env.SENTINEL_MODE || (runtime.isDemo ? 'demo' : 'live')).trim().toLowerCase();

    assertOneOf('saqr-sentinel', 'SENTINEL_MODE', mode, SUPPORTED_MODES);
    assertNoDemoModeInProduction(runtime, 'saqr-sentinel', mode, 'SENTINEL_MODE');

    const schedule = assertCronExpression(
        'saqr-sentinel',
        'SENTINEL_CRON',
        env.SENTINEL_CRON || '*/15 * * * *'
    );

    const { config: db, warnings } = buildDbConfig(env, runtime, 'saqr-sentinel');

    return {
        runtime,
        mode,
        schedule,
        authorities: AUTHORITIES,
        browser: {
            headless: envFlag(env.SENTINEL_BROWSER_HEADLESS, true),
        },
        bridge: {
            validateDbOnStartup: envFlag(env.SENTINEL_VALIDATE_DB_ON_STARTUP, runtime.isProductionReady),
        },
        db,
        warnings,
    };
}

module.exports = {
    SUPPORTED_MODES,
    AUTHORITIES,
    buildSentinelConfig,
};
