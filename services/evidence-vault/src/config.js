const {
    resolveRuntimeProfile,
    envFlag,
    envList,
    assertRequiredInProduction,
} = require('../../../shared/runtime-profile');
const {
    buildDbConfig,
    buildLocalAddressWarning,
    assertNonEmptyList,
    assertNonPlaceholderInProduction,
    assertPositiveInteger,
} = require('../../../shared/service-config');

const DEFAULT_TOPICS = [
    'saqr.cdc.client_banking.public.consumer_disclosures',
    'saqr.cdc.client_banking.public.fee_schedule',
    'saqr.cdc.client_banking.public.cooling_off_periods',
    'saqr.cdc.client_banking.public.branch_compliance',
];

function buildEvidenceVaultConfig(env = process.env) {
    const runtime = resolveRuntimeProfile(env, 'saqr-evidence-vault');
    const { config: db, warnings } = buildDbConfig(env, runtime, 'saqr-evidence-vault');
    const brokers = assertNonEmptyList(
        'saqr-evidence-vault',
        'KAFKA_BOOTSTRAP_SERVERS',
        envList(env.KAFKA_BOOTSTRAP_SERVERS, ['localhost:9092'])
    );
    const topics = assertNonEmptyList(
        'saqr-evidence-vault',
        'EVIDENCE_VAULT_TOPICS',
        envList(env.EVIDENCE_VAULT_TOPICS, DEFAULT_TOPICS)
    );

    if (runtime.isProductionReady) {
        assertRequiredInProduction(runtime, 'saqr-evidence-vault', 'KAFKA_BOOTSTRAP_SERVERS', env.KAFKA_BOOTSTRAP_SERVERS);
        assertNonPlaceholderInProduction(
            runtime,
            'saqr-evidence-vault',
            'KAFKA_BOOTSTRAP_SERVERS',
            env.KAFKA_BOOTSTRAP_SERVERS
        );
    }

    brokers.forEach((broker, index) => {
        const host = String(broker).split(':')[0];
        const warning = buildLocalAddressWarning(
            runtime,
            'saqr-evidence-vault',
            `KAFKA_BOOTSTRAP_SERVERS[${index}]`,
            host
        );
        if (warning) warnings.push(warning);
    });

    const ntpServer = env.NTP_SERVER || 'pool.ntp.org';
    if (runtime.isProductionReady) {
        assertNonPlaceholderInProduction(runtime, 'saqr-evidence-vault', 'NTP_SERVER', ntpServer);
    }

    return {
        runtime,
        kafka: {
            brokers,
            clientId: env.KAFKA_CLIENT_ID || 'saqr-evidence-vault',
            groupId: env.KAFKA_GROUP_ID || 'saqr-vault-consumer',
        },
        db,
        ntp: {
            server: ntpServer,
            timeoutMs: assertPositiveInteger(
                'saqr-evidence-vault',
                'NTP_TIMEOUT_MS',
                env.NTP_TIMEOUT_MS || '3000',
                { min: 500, max: 30000 }
            ),
            allowSystemClockFallback: envFlag(
                env.EVIDENCE_VAULT_ALLOW_SYSTEM_CLOCK_FALLBACK,
                runtime.isDemo
            ),
        },
        topics,
        startup: {
            validateDbOnStartup: envFlag(env.EVIDENCE_VAULT_VALIDATE_DB_ON_STARTUP, true),
            validateNtpOnStartup: envFlag(env.EVIDENCE_VAULT_VALIDATE_NTP_ON_STARTUP, runtime.isProductionReady),
        },
        warnings,
    };
}

module.exports = {
    DEFAULT_TOPICS,
    buildEvidenceVaultConfig,
};
