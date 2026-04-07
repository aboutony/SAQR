const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildPlatformConfig } = require('./platform-config');

describe('SAQR API platform config', () => {
    it('keeps demo runtime auth disabled by default', () => {
        const config = buildPlatformConfig({
            SAQR_RUNTIME_MODE: 'demo',
        });

        assert.equal(config.runtime.mode, 'demo');
        assert.equal(config.auth.enabled, false);
        assert.equal(config.sources.heartbeatPublic, true);
        assert.deepStrictEqual(config.sources.authorities, ['SAMA', 'SDAIA', 'ZATCA', 'SFDA', 'MOH', 'MOMAH', 'MHRSD']);
    });

    it('forces auth on in production-ready runtime', () => {
        const config = buildPlatformConfig({
            SAQR_RUNTIME_MODE: 'production',
            AUTH_ENABLED: 'false',
            JWT_SECRET: 'delivery-secret',
            SHADOW_DB_HOST: 'shadow-db.internal',
            SHADOW_DB_NAME: 'saqr_shadow',
            SHADOW_DB_USER: 'saqr_runtime',
            SHADOW_DB_PASSWORD: 'super-secret',
        });

        assert.equal(config.runtime.mode, 'production-ready');
        assert.equal(config.auth.enabled, true);
        assert.equal(config.sources.heartbeatPublic, false);
        assert.deepStrictEqual(config.sources.authorities, ['SAMA', 'SDAIA']);
    });

    it('requires JWT_SECRET in production-ready runtime', () => {
        assert.throws(() => buildPlatformConfig({
            SAQR_RUNTIME_MODE: 'production',
            SHADOW_DB_HOST: 'shadow-db.internal',
            SHADOW_DB_NAME: 'saqr_shadow',
            SHADOW_DB_USER: 'saqr_runtime',
            SHADOW_DB_PASSWORD: 'super-secret',
        }), /JWT_SECRET must be provided/);
    });

    it('supports production authority overrides for delivery handoff', () => {
        const config = buildPlatformConfig({
            SAQR_RUNTIME_MODE: 'production',
            JWT_SECRET: 'delivery-secret',
            SHADOW_DB_HOST: 'shadow-db.internal',
            SHADOW_DB_NAME: 'saqr_shadow',
            SHADOW_DB_USER: 'saqr_runtime',
            SHADOW_DB_PASSWORD: 'super-secret',
            SAQR_REGULATORY_AUTHORITIES: 'SAMA,SDAIA,ZATCA',
        });

        assert.deepStrictEqual(config.sources.authorities, ['SAMA', 'SDAIA', 'ZATCA']);
    });
});
