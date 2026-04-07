const {
    resolveRuntimeProfile,
    envFlag,
} = require('../../../shared/runtime-profile');
const {
    buildDbConfig,
    assertOneOf,
} = require('../../../shared/service-config');

const SUPPORTED_BOOT_MODES = ['demo-ingest', 'service'];

function buildNlpConfig(env = process.env) {
    const runtime = resolveRuntimeProfile(env, 'saqr-nlp-interpreter');
    const bootMode = String(env.NLP_BOOT_MODE || (runtime.isDemo ? 'demo-ingest' : 'service'))
        .trim()
        .toLowerCase();

    assertOneOf('saqr-nlp-interpreter', 'NLP_BOOT_MODE', bootMode, SUPPORTED_BOOT_MODES);

    if (runtime.isProductionReady && bootMode === 'demo-ingest') {
        throw new Error(
            `[saqr-nlp-interpreter] NLP_BOOT_MODE=${bootMode} is not allowed when SAQR_RUNTIME_MODE=${runtime.mode}`
        );
    }

    const { config: db, warnings } = buildDbConfig(env, runtime, 'saqr-nlp-interpreter');

    return {
        runtime,
        db,
        nlp: {
            bootMode,
        },
        startup: {
            validateDbOnStartup: envFlag(env.NLP_VALIDATE_DB_ON_STARTUP, runtime.isProductionReady),
        },
        warnings,
    };
}

module.exports = {
    SUPPORTED_BOOT_MODES,
    buildNlpConfig,
};
