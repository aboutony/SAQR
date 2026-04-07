const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    verifyJwt,
    derivePermissions,
    createRouteGuard,
    createTestToken,
} = require('./auth');
const { ROLE_PERMISSIONS } = require('./platform-config');

function buildConfig(overrides = {}) {
    return {
        enabled: true,
        secret: 'saqr-test-secret',
        issuer: 'saqr',
        audience: 'saqr-api',
        leewaySeconds: 0,
        rolePermissions: ROLE_PERMISSIONS,
        ...overrides,
    };
}

function buildReply() {
    return {
        statusCode: 200,
        payload: null,
        code(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        send(payload) {
            this.payload = payload;
            return this;
        },
    };
}

describe('SAQR API auth', () => {
    it('verifies a valid HS256 bearer token', () => {
        const now = Math.floor(Date.now() / 1000);
        const config = buildConfig();
        const token = createTestToken({
            sub: 'user-123',
            iss: 'saqr',
            aud: 'saqr-api',
            exp: now + 60,
            roles: ['viewer'],
        }, config);

        const payload = verifyJwt(token, config);

        assert.equal(payload.sub, 'user-123');
        assert.deepStrictEqual(payload.roles, ['viewer']);
    });

    it('rejects expired tokens', () => {
        const now = Math.floor(Date.now() / 1000);
        const config = buildConfig();
        const token = createTestToken({
            sub: 'user-123',
            iss: 'saqr',
            aud: 'saqr-api',
            exp: now - 5,
        }, config);

        assert.throws(() => verifyJwt(token, config), /expired/);
    });

    it('derives permissions from assigned roles and explicit grants', () => {
        const permissions = derivePermissions({
            role: 'analyst',
            permissions: ['custom.export'],
        }, ROLE_PERMISSIONS);

        assert.ok(permissions.includes('dashboard.read'));
        assert.ok(permissions.includes('cdc.read'));
        assert.ok(permissions.includes('custom.export'));
    });

    it('returns 401 when an authenticated route is called without a bearer token', async () => {
        const guard = createRouteGuard(buildConfig(), {
            permissions: ['dashboard.read'],
        });
        const request = { headers: {} };
        const reply = buildReply();

        await guard(request, reply);

        assert.equal(reply.statusCode, 401);
        assert.equal(reply.payload.error, 'UNAUTHORIZED');
        assert.deepStrictEqual(reply.payload.requiredPermissions, ['dashboard.read']);
    });

    it('accepts valid role-derived permissions for protected routes', async () => {
        const now = Math.floor(Date.now() / 1000);
        const config = buildConfig();
        const token = createTestToken({
            sub: 'analyst-1',
            iss: 'saqr',
            aud: 'saqr-api',
            exp: now + 60,
            roles: ['analyst'],
        }, config);
        const guard = createRouteGuard(config, {
            permissions: ['dashboard.read', 'cdc.read'],
        });
        const request = {
            headers: {
                authorization: `Bearer ${token}`,
            },
        };
        const reply = buildReply();

        await guard(request, reply);

        assert.equal(reply.statusCode, 200);
        assert.equal(reply.payload, null);
        assert.equal(request.authContext.subject, 'analyst-1');
        assert.ok(request.authContext.permissions.includes('cdc.read'));
    });
});
