const DEMO_MODE = 'demo';
const PRODUCTION_READY_MODE = 'production-ready';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled', 'required']);
const PRODUCTION_ALIASES = new Set(['production', 'production-ready', 'prod', 'handoff']);

function normaliseRuntimeMode(rawMode) {
    const mode = String(rawMode || DEMO_MODE).trim().toLowerCase();
    return PRODUCTION_ALIASES.has(mode) ? PRODUCTION_READY_MODE : DEMO_MODE;
}

function resolveRuntimeProfile(env = process.env, component = 'saqr') {
    const mode = normaliseRuntimeMode(env.SAQR_RUNTIME_MODE);

    return {
        component,
        mode,
        isDemo: mode === DEMO_MODE,
        isProductionReady: mode === PRODUCTION_READY_MODE,
    };
}

function envFlag(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') return defaultValue;
    return TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function envNumber(value, defaultValue) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
}

function envList(value, fallback = []) {
    if (!value) return [...fallback];
    return String(value)
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

function assertNoDemoModeInProduction(runtime, componentName, configuredValue, envVarName) {
    if (!runtime.isProductionReady) return;
    if (String(configuredValue || '').trim().toLowerCase() !== DEMO_MODE) return;

    throw new Error(
        `[${componentName}] ${envVarName}=${configuredValue} is not allowed when SAQR_RUNTIME_MODE=${runtime.mode}`
    );
}

function assertRequiredInProduction(runtime, componentName, envVarName, configuredValue) {
    if (!runtime.isProductionReady) return;
    if (configuredValue !== undefined && configuredValue !== null && configuredValue !== '') return;

    throw new Error(
        `[${componentName}] ${envVarName} must be provided when SAQR_RUNTIME_MODE=${runtime.mode}`
    );
}

module.exports = {
    DEMO_MODE,
    PRODUCTION_READY_MODE,
    resolveRuntimeProfile,
    envFlag,
    envNumber,
    envList,
    assertNoDemoModeInProduction,
    assertRequiredInProduction,
};
