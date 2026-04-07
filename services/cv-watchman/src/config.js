const {
    resolveRuntimeProfile,
    assertNoDemoModeInProduction,
    envFlag,
} = require('../../../shared/runtime-profile');
const {
    buildDbConfig,
    buildLocalAddressWarning,
    assertNonPlaceholderInProduction,
    assertOneOf,
    assertPositiveInteger,
} = require('../../../shared/service-config');

const SUPPORTED_VMS_TYPES = ['demo', 'milestone', 'genetec'];

function defaultPortForVmsType(vmsType) {
    switch (vmsType) {
        case 'milestone':
            return 443;
        case 'genetec':
            return 4590;
        default:
            return 1;
    }
}

function buildCvConfig(env = process.env) {
    const runtime = resolveRuntimeProfile(env, 'saqr-cv-watchman');
    const vmsType = String(env.VMS_TYPE || (runtime.isDemo ? 'demo' : 'milestone')).trim().toLowerCase();

    assertOneOf('saqr-cv-watchman', 'VMS_TYPE', vmsType, SUPPORTED_VMS_TYPES);
    assertNoDemoModeInProduction(runtime, 'saqr-cv-watchman', vmsType, 'VMS_TYPE');

    const scanIntervalMs = assertPositiveInteger(
        'saqr-cv-watchman',
        'CV_SCAN_INTERVAL',
        env.CV_SCAN_INTERVAL || '5000',
        { min: 1000, max: 3600000 }
    );

    const { config: db, warnings } = buildDbConfig(env, runtime, 'saqr-cv-watchman');
    const connection = {
        host: env.CV_VMS_HOST || 'localhost',
        port: assertPositiveInteger(
            'saqr-cv-watchman',
            'CV_VMS_PORT',
            env.CV_VMS_PORT || String(defaultPortForVmsType(vmsType)),
            { min: 1, max: 65535 }
        ),
        username: env.CV_VMS_USERNAME || '',
        password: env.CV_VMS_PASSWORD || '',
        useTLS: envFlag(env.CV_VMS_USE_TLS, true),
        appId: env.CV_VMS_APP_ID || 'SAQR-Watchman',
        maxFps: assertPositiveInteger(
            'saqr-cv-watchman',
            'CV_VMS_MAX_FPS',
            env.CV_VMS_MAX_FPS || '1',
            { min: 1, max: 10 }
        ),
    };

    if (runtime.isProductionReady && vmsType !== 'demo') {
        assertNonPlaceholderInProduction(runtime, 'saqr-cv-watchman', 'CV_VMS_HOST', connection.host);
        assertNonPlaceholderInProduction(runtime, 'saqr-cv-watchman', 'CV_VMS_USERNAME', connection.username);
        assertNonPlaceholderInProduction(runtime, 'saqr-cv-watchman', 'CV_VMS_PASSWORD', connection.password);
    }

    const vmsHostWarning = buildLocalAddressWarning(runtime, 'saqr-cv-watchman', 'CV_VMS_HOST', connection.host);
    if (vmsHostWarning) warnings.push(vmsHostWarning);

    return {
        runtime,
        db,
        cv: {
            scanIntervalMs,
            vmsType,
            connection,
        },
        startup: {
            validateDbOnStartup: envFlag(env.CV_VALIDATE_DB_ON_STARTUP, runtime.isProductionReady),
        },
        warnings,
    };
}

module.exports = {
    SUPPORTED_VMS_TYPES,
    buildCvConfig,
};
