const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildSentinelConfig } = require('./config');

describe('Sentinel config', () => {
    it('defaults to demo mode in demo runtime', () => {
        const config = buildSentinelConfig({
            SAQR_RUNTIME_MODE: 'demo',
        });

        assert.equal(config.runtime.mode, 'demo');
        assert.equal(config.mode, 'demo');
        assert.equal(config.bridge.validateDbOnStartup, false);
    });

    it('rejects demo mode in production-ready runtime', () => {
        assert.throws(() => buildSentinelConfig({
            SAQR_RUNTIME_MODE: 'production',
            SHADOW_DB_HOST: 'shadow-db.internal',
            SHADOW_DB_NAME: 'saqr_shadow',
            SHADOW_DB_USER: 'saqr_runtime',
            SHADOW_DB_PASSWORD: 'super-secret',
            SENTINEL_MODE: 'demo',
        }), /not allowed/);
    });
});
