const {
    resolveRuntimeProfile,
    envFlag,
    envList,
    envNumber,
    assertRequiredInProduction,
} = require('../../../shared/runtime-profile');
const {
    buildDbConfig,
    buildLocalAddressWarning,
    assertNonPlaceholderInProduction,
    assertPositiveInteger,
} = require('../../../shared/service-config');

const AUTHORITY_CATALOG = {
    SAMA: { code: 'SAMA', name: 'Saudi Central Bank', name_ar: 'البنك المركزي السعودي' },
    SDAIA: { code: 'SDAIA', name: 'Saudi Data & AI Authority', name_ar: 'هيئة البيانات والذكاء الاصطناعي' },
    ZATCA: { code: 'ZATCA', name: 'Zakat, Tax & Customs Authority', name_ar: 'هيئة الزكاة والضريبة والجمارك' },
    SFDA: { code: 'SFDA', name: 'Saudi Food & Drug Authority', name_ar: 'الهيئة العامة للغذاء والدواء' },
    MOH: { code: 'MOH', name: 'Ministry of Health', name_ar: 'وزارة الصحة' },
    MOMAH: { code: 'MOMAH', name: 'Ministry of Municipal & Rural Affairs', name_ar: 'وزارة الشؤون البلدية والقروية' },
    MHRSD: { code: 'MHRSD', name: 'Ministry of Human Resources & Social Development', name_ar: 'وزارة الموارد البشرية والتنمية الاجتماعية' },
};

const DEMO_SOURCE_AUTHORITIES = ['SAMA', 'SDAIA', 'ZATCA', 'SFDA', 'MOH', 'MOMAH', 'MHRSD'];
const PRODUCTION_SOURCE_AUTHORITIES = ['SAMA', 'SDAIA'];

const ROLE_PERMISSIONS = {
    viewer: [
        'saqr.read',
        'dashboard.read',
        'violations.read',
        'evidence.read',
        'references.read',
        'nlp.read',
        'cv.read',
        'sources.read',
    ],
    analyst: [
        'saqr.read',
        'dashboard.read',
        'violations.read',
        'evidence.read',
        'references.read',
        'nlp.read',
        'cv.read',
        'sources.read',
        'cdc.read',
    ],
    auditor: [
        'saqr.read',
        'dashboard.read',
        'violations.read',
        'evidence.read',
        'references.read',
        'nlp.read',
        'cv.read',
        'sources.read',
        'cdc.read',
        'audit.read',
    ],
    board: [
        'dashboard.read',
        'violations.read',
        'evidence.read',
        'sources.read',
    ],
    admin: ['*'],
};

function resolveSourceAuthorities(authorityCodes) {
    return authorityCodes
        .map(code => AUTHORITY_CATALOG[code])
        .filter(Boolean)
        .map(entry => ({
            ...entry,
            status: 'active',
            lastSync: new Date().toISOString(),
        }));
}

function buildPlatformConfig(env = process.env) {
    const runtime = resolveRuntimeProfile(env, 'saqr-api');
    const authEnabled = runtime.isProductionReady
        ? true
        : envFlag(env.AUTH_ENABLED, false);
    const { config: db, warnings } = buildDbConfig(env, runtime, 'saqr-api');
    const apiHost = env.API_HOST || '0.0.0.0';
    const apiPort = assertPositiveInteger('saqr-api', 'API_PORT', env.API_PORT || '3001', {
        min: 1,
        max: 65535,
    });

    if (authEnabled) {
        assertRequiredInProduction(runtime, 'saqr-api', 'JWT_SECRET', env.JWT_SECRET);
        assertNonPlaceholderInProduction(runtime, 'saqr-api', 'JWT_SECRET', env.JWT_SECRET);
    }

    const apiHostWarning = buildLocalAddressWarning(runtime, 'saqr-api', 'API_HOST', apiHost);
    if (apiHostWarning) warnings.push(apiHostWarning);

    const regulatoryAuthorities = envList(
        env.SAQR_REGULATORY_AUTHORITIES,
        runtime.isDemo ? DEMO_SOURCE_AUTHORITIES : PRODUCTION_SOURCE_AUTHORITIES
    );

    return {
        runtime,
        api: {
            host: apiHost,
            port: apiPort,
        },
        db,
        auth: {
            enabled: authEnabled,
            secret: env.JWT_SECRET || '',
            issuer: env.AUTH_JWT_ISSUER || 'saqr',
            audience: env.AUTH_JWT_AUDIENCE || 'saqr-api',
            leewaySeconds: envNumber(env.AUTH_JWT_LEEWAY_SECONDS, 30),
            rolePermissions: ROLE_PERMISSIONS,
        },
        sources: {
            heartbeatPublic: envFlag(env.PUBLIC_SOURCES_HEARTBEAT_ENABLED, runtime.isDemo),
            authorities: regulatoryAuthorities,
        },
        warnings,
    };
}

module.exports = {
    AUTHORITY_CATALOG,
    ROLE_PERMISSIONS,
    buildPlatformConfig,
    resolveSourceAuthorities,
};
