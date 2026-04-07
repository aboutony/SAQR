const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildEvidenceVaultConfig } = require('./config');

describe('Evidence Vault config', () => {
    it('supports demo defaults', () => {
        const config = buildEvidenceVaultConfig({
            SAQR_RUNTIME_MODE: 'demo',
        });

        assert.equal(config.runtime.mode, 'demo');
        assert.deepStrictEqual(config.kafka.brokers, ['localhost:9092']);
        assert.equal(config.ntp.allowSystemClockFallback, true);
    });

    it('requires Kafka bootstrap servers in production-ready runtime', () => {
        assert.throws(() => buildEvidenceVaultConfig({
            SAQR_RUNTIME_MODE: 'production',
            SHADOW_DB_HOST: 'shadow-db.internal',
            SHADOW_DB_NAME: 'saqr_shadow',
            SHADOW_DB_USER: 'saqr_runtime',
            SHADOW_DB_PASSWORD: 'super-secret',
        }), /KAFKA_BOOTSTRAP_SERVERS must be provided/);
    });
});
