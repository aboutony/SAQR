const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildCvConfig } = require('./config');

describe('CV config', () => {
    it('defaults to demo VMS in demo runtime', () => {
        const config = buildCvConfig({
            SAQR_RUNTIME_MODE: 'demo',
        });

        assert.equal(config.runtime.mode, 'demo');
        assert.equal(config.cv.vmsType, 'demo');
        assert.equal(config.startup.validateDbOnStartup, false);
    });

    it('requires real VMS credentials in production-ready runtime', () => {
        assert.throws(() => buildCvConfig({
            SAQR_RUNTIME_MODE: 'production',
            SHADOW_DB_HOST: 'shadow-db.internal',
            SHADOW_DB_NAME: 'saqr_shadow',
            SHADOW_DB_USER: 'saqr_runtime',
            SHADOW_DB_PASSWORD: 'super-secret',
            VMS_TYPE: 'milestone',
            CV_VMS_HOST: 'replace-by-delivery-team',
            CV_VMS_USERNAME: 'replace-by-delivery-team',
            CV_VMS_PASSWORD: 'replace-by-delivery-team',
        }), /must not use a placeholder value/);
    });
});
