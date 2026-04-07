const { assertRequiredInProduction } = require('./runtime-profile');

const PLACEHOLDER_PATTERNS = [
    /^change_me/i,
    /^replace/i,
    /placeholder/i,
    /^example$/i,
    /^todo$/i,
    /^tbd$/i,
    /^your[-_]/i,
];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === '';
}

function isPlaceholderValue(value) {
    if (isBlank(value)) return false;
    const text = String(value).trim();
    return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(text));
}

function assertNonPlaceholderInProduction(runtime, componentName, envVarName, configuredValue) {
    if (!runtime.isProductionReady) return;

    assertRequiredInProduction(runtime, componentName, envVarName, configuredValue);

    if (isPlaceholderValue(configuredValue)) {
        throw new Error(
            `[${componentName}] ${envVarName} must not use a placeholder value when SAQR_RUNTIME_MODE=${runtime.mode}`
        );
    }
}

function assertOneOf(componentName, envVarName, configuredValue, allowedValues) {
    if (!allowedValues.includes(configuredValue)) {
        throw new Error(
            `[${componentName}] ${envVarName}=${configuredValue} is invalid. Allowed values: ${allowedValues.join(', ')}`
        );
    }

    return configuredValue;
}

function assertPositiveInteger(componentName, envVarName, configuredValue, {
    min = 1,
    max = Number.MAX_SAFE_INTEGER,
} = {}) {
    const parsed = Number.parseInt(configuredValue, 10);

    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
        throw new Error(
            `[${componentName}] ${envVarName} must be an integer between ${min} and ${max}. Received: ${configuredValue}`
        );
    }

    return parsed;
}

function assertNonEmptyList(componentName, envVarName, values) {
    if (!Array.isArray(values) || values.length === 0) {
        throw new Error(`[${componentName}] ${envVarName} must define at least one value`);
    }

    return values;
}

function assertCronExpression(componentName, envVarName, configuredValue) {
    const cron = String(configuredValue || '').trim();
    const parts = cron.split(/\s+/).filter(Boolean);

    if (parts.length < 5 || parts.length > 6) {
        throw new Error(
            `[${componentName}] ${envVarName} must be a valid 5- or 6-field cron expression. Received: ${configuredValue}`
        );
    }

    return cron;
}

function buildLocalAddressWarning(runtime, componentName, envVarName, configuredValue) {
    if (!runtime.isProductionReady || isBlank(configuredValue)) return null;
    const normalised = String(configuredValue).trim().toLowerCase();

    if (!LOCAL_HOSTS.has(normalised)) return null;

    return `[${componentName}] ${envVarName} resolves to local address "${configuredValue}" in production-ready runtime`;
}

function buildDbConfig(env, runtime, componentName, { prefix = 'SHADOW_DB' } = {}) {
    const host = env[`${prefix}_HOST`] || 'localhost';
    const port = assertPositiveInteger(componentName, `${prefix}_PORT`, env[`${prefix}_PORT`] || '5432', {
        min: 1,
        max: 65535,
    });
    const database = env[`${prefix}_NAME`] || 'saqr_shadow';
    const user = env[`${prefix}_USER`] || 'saqr';
    const password = env[`${prefix}_PASSWORD`] || 'saqr_dev_password';

    if (runtime.isProductionReady) {
        assertNonPlaceholderInProduction(runtime, componentName, `${prefix}_HOST`, host);
        assertNonPlaceholderInProduction(runtime, componentName, `${prefix}_NAME`, database);
        assertNonPlaceholderInProduction(runtime, componentName, `${prefix}_USER`, user);
        assertNonPlaceholderInProduction(runtime, componentName, `${prefix}_PASSWORD`, password);
    }

    const warnings = [];
    const localAddressWarning = buildLocalAddressWarning(runtime, componentName, `${prefix}_HOST`, host);
    if (localAddressWarning) warnings.push(localAddressWarning);

    return {
        config: {
            host,
            port,
            database,
            user,
            password,
        },
        warnings,
    };
}

function redactSecret(value) {
    if (isBlank(value)) return '(unset)';
    const text = String(value);
    if (text.length <= 4) return '****';
    return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

module.exports = {
    isPlaceholderValue,
    assertNonPlaceholderInProduction,
    assertOneOf,
    assertPositiveInteger,
    assertNonEmptyList,
    assertCronExpression,
    buildDbConfig,
    buildLocalAddressWarning,
    redactSecret,
};
