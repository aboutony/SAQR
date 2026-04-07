// ============================================
// SAQR Evidence Vault - Main Service
// Kafka consumer -> compliance engine -> evidence store
// ============================================

const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const { getNtpTimestamp } = require('./ntp');
const { buildEvidenceVaultConfig } = require('./config');
const {
    createCdcMessageProcessor,
    createComplianceEvaluator,
    createDebeziumMessageDecoder,
    createMerkleBatchProcessor,
    createNtpTimestampAuthority,
    createPostgresEvidenceRepository,
} = require('./cdc-flow');
const { createServiceLogger, installProcessHandlers } = require('../../../shared/observability');
const { createPostgresAdapter } = require('../../../shared/postgres-adapter');

const config = buildEvidenceVaultConfig(process.env);
const logger = createServiceLogger({ service: 'saqr-evidence-vault', runtime: config.runtime });
let consumer;

const pool = new Pool(config.db);
const db = createPostgresAdapter(pool, {
    name: 'saqr-evidence-vault-db',
    logger,
});
const repository = createPostgresEvidenceRepository(db);
const processMessage = createCdcMessageProcessor({
    messageDecoder: createDebeziumMessageDecoder(),
    timestampAuthority: createNtpTimestampAuthority(config.ntp, logger),
    complianceEvaluator: createComplianceEvaluator(),
    repository,
    logger,
});
const computeDailyMerkle = createMerkleBatchProcessor({
    repository,
    logger,
});

async function main() {
    config.warnings.forEach((warning) => logger.warn('startup.configuration_warning', { warning }));
    logger.info('service.startup.completed', {
        kafkaBrokers: config.kafka.brokers,
        topicCount: config.topics.length,
        ntpServer: config.ntp.server,
        ntpFallbackEnabled: config.ntp.allowSystemClockFallback,
    });

    try {
        await db.healthcheck();
        logger.info('dependency.shadow_db.connected');
    } catch (error) {
        logger.error('dependency.shadow_db.failed', error, {
            startupValidationRequired: config.startup.validateDbOnStartup,
        });
        if (config.startup.validateDbOnStartup) {
            process.exit(1);
        }
        logger.warn('dependency.shadow_db.deferred_validation', {
            message: 'Continuing without DB startup validation; persistence calls will fail until DB connectivity is restored.',
        });
    }

    if (config.startup.validateNtpOnStartup) {
        try {
            const ntp = await getNtpTimestamp(config.ntp.server, config.ntp.timeoutMs, {
                allowSystemClockFallback: config.ntp.allowSystemClockFallback,
                logger,
            });
            logger.info('dependency.ntp.validated', {
                source: ntp.source,
            });
        } catch (error) {
            logger.fatal('dependency.ntp.failed', error);
            process.exit(1);
        }
    }

    const kafka = new Kafka({
        clientId: config.kafka.clientId,
        brokers: config.kafka.brokers,
    });

    consumer = kafka.consumer({ groupId: config.kafka.groupId });

    await consumer.connect();
    logger.info('dependency.kafka.connected', {
        groupId: config.kafka.groupId,
    });

    for (const topic of config.topics) {
        await consumer.subscribe({ topic, fromBeginning: true });
        logger.info('dependency.kafka.topic_subscribed', { topic });
    }

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            try {
                await processMessage(message);
            } catch (error) {
                logger.error('cdc.message_processing_failed', error, {
                    topic,
                    partition,
                });
            }
        },
    });

    setInterval(async () => {
        try {
            await computeDailyMerkle();
        } catch (error) {
            logger.error('merkle.batch.failed', error);
        }
    }, 60 * 60 * 1000);

    logger.info('service.ready', {
        readOnly: true,
        awaiting: 'cdc_events',
    });
}

module.exports = {
    computeDailyMerkle,
    main,
    processMessage,
};

if (require.main === module) {
    installProcessHandlers({
        logger,
        onShutdown: async () => {
            if (consumer) {
                await consumer.disconnect().catch(() => { });
            }
            await db.close().catch(() => { });
        },
    });

    main().catch((error) => {
        logger.fatal('service.startup.failed', error);
        process.exit(1);
    });
}
