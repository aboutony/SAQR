const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildNlpConfig } = require('./config');

describe('NLP config', () => {
    it('defaults to demo-ingest mode in demo runtime', () => {
        const config = buildNlpConfig({
            SAQR_RUNTIME_MODE: 'demo',
        });

        assert.equal(config.runtime.mode, 'demo');
        assert.equal(config.nlp.bootMode, 'demo-ingest');
        assert.equal(config.startup.validateDbOnStartup, false);
    });

    it('rejects demo-ingest mode in production-ready runtime', () => {
        assert.throws(() => buildNlpConfig({
            SAQR_RUNTIME_MODE: 'production',
            SHADOW_DB_HOST: 'shadow-db.internal',
            SHADOW_DB_NAME: 'saqr_shadow',
            SHADOW_DB_USER: 'saqr_runtime',
            SHADOW_DB_PASSWORD: 'super-secret',
            NLP_BOOT_MODE: 'demo-ingest',
        }), /not allowed/);
    });
});
