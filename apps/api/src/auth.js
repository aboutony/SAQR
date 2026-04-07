const crypto = require('crypto');

function encodeBase64Url(buffer) {
    return buffer.toString('base64url');
}

function decodeBase64Url(value) {
    return Buffer.from(value, 'base64url').toString('utf8');
}

function parseJwtPart(part, label) {
    try {
        return JSON.parse(decodeBase64Url(part));
    } catch (err) {
        throw new Error(`Invalid JWT ${label}`);
    }
}

function signHs256(unsignedToken, secret) {
    return encodeBase64Url(
        crypto.createHmac('sha256', secret).update(unsignedToken).digest()
    );
}

function verifySignature(unsignedToken, actualSignature, secret) {
    const expectedSignature = signHs256(unsignedToken, secret);
    const expected = Buffer.from(expectedSignature);
    const actual = Buffer.from(actualSignature || '');

    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
}

function assertTemporalClaim(payload, claim, nowSeconds, leewaySeconds, comparator, message) {
    if (payload[claim] === undefined) return;
    if (!comparator(Number(payload[claim]), nowSeconds, leewaySeconds)) {
        throw new Error(message);
    }
}

function verifyJwt(token, config) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw new Error('Malformed bearer token');

    const [headerPart, payloadPart, signaturePart] = parts;
    const header = parseJwtPart(headerPart, 'header');
    const payload = parseJwtPart(payloadPart, 'payload');

    if (header.alg !== 'HS256') {
        throw new Error(`Unsupported JWT algorithm: ${header.alg || 'unknown'}`);
    }

    const unsignedToken = `${headerPart}.${payloadPart}`;
    if (!verifySignature(unsignedToken, signaturePart, config.secret)) {
        throw new Error('JWT signature verification failed');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const leeway = config.leewaySeconds || 0;

    if (config.issuer && payload.iss !== config.issuer) {
        throw new Error('JWT issuer mismatch');
    }

    if (config.audience) {
        const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        if (!audience.includes(config.audience)) {
            throw new Error('JWT audience mismatch');
        }
    }

    assertTemporalClaim(
        payload,
        'exp',
        nowSeconds,
        leeway,
        (value, now, tolerance) => value + tolerance >= now,
        'JWT has expired'
    );

    assertTemporalClaim(
        payload,
        'nbf',
        nowSeconds,
        leeway,
        (value, now, tolerance) => value - tolerance <= now,
        'JWT not active yet'
    );

    return payload;
}

function derivePermissions(payload, rolePermissions) {
    const permissions = new Set(Array.isArray(payload.permissions) ? payload.permissions : []);
    const roles = Array.isArray(payload.roles)
        ? payload.roles
        : payload.role
            ? [payload.role]
            : [];

    for (const role of roles) {
        const grants = rolePermissions[role] || [];
        grants.forEach(permission => permissions.add(permission));
    }

    return [...permissions];
}

function hasPermissions(granted, required) {
    if (!required || required.length === 0) return true;
    if (granted.includes('*')) return true;
    return required.every(permission => granted.includes(permission));
}

function getBearerToken(request) {
    const header = request.headers.authorization || request.headers.Authorization;
    if (!header || !String(header).startsWith('Bearer ')) return null;
    return String(header).slice('Bearer '.length).trim();
}

function buildAuthContext(payload, permissions, config) {
    return {
        authenticated: true,
        subject: payload.sub || null,
        email: payload.email || null,
        tenantId: payload.tenant_id || payload.tenantId || null,
        roles: Array.isArray(payload.roles) ? payload.roles : payload.role ? [payload.role] : [],
        permissions,
        issuer: payload.iss || config.issuer,
        audience: payload.aud || config.audience,
        claims: payload,
    };
}

function sendAuthError(request, reply, statusCode, code, message, requiredPermissions = []) {
    request?.audit?.('security.auth_denied', {
        outcome: code === 'FORBIDDEN' ? 'forbidden' : 'unauthorized',
        statusCode,
        reason: message,
        requiredPermissions,
    });

    return reply.code(statusCode).send({
        error: code,
        message,
        requiredPermissions,
    });
}

function createRouteGuard(config, options = {}) {
    const requiredPermissions = options.permissions || [];

    return async function routeGuard(request, reply) {
        if (!config.enabled) {
            request.authContext = {
                authenticated: false,
                mode: 'disabled',
                permissions: ['*'],
            };
            return;
        }

        const token = getBearerToken(request);
        if (!token) {
            return sendAuthError(request, reply, 401, 'UNAUTHORIZED', 'Bearer token is required', requiredPermissions);
        }

        let payload;
        try {
            payload = verifyJwt(token, config);
        } catch (err) {
            return sendAuthError(request, reply, 401, 'UNAUTHORIZED', err.message, requiredPermissions);
        }

        const permissions = derivePermissions(payload, config.rolePermissions);
        request.authContext = buildAuthContext(payload, permissions, config);

        if (!hasPermissions(permissions, requiredPermissions)) {
            return sendAuthError(request, reply, 403, 'FORBIDDEN', 'Insufficient permissions', requiredPermissions);
        }
    };
}

function registerAuth(fastify, config) {
    fastify.decorateRequest('authContext', null);
    fastify.decorate('requireAuth', (options = {}) => createRouteGuard(config, options));

    fastify.get('/api/auth/me', {
        preHandler: createRouteGuard(config),
    }, async (request) => {
        if (!request.authContext || !request.authContext.authenticated) {
            return {
                authenticated: false,
                mode: config.enabled ? 'required' : 'disabled',
            };
        }

        const { claims, ...safeContext } = request.authContext;
        return {
            authenticated: true,
            mode: config.enabled ? 'required' : 'disabled',
            ...safeContext,
        };
    });
}

function createTestToken(payload, config) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = encodeBase64Url(Buffer.from(JSON.stringify(header)));
    const encodedPayload = encodeBase64Url(Buffer.from(JSON.stringify(payload)));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const signature = signHs256(unsignedToken, config.secret);
    return `${unsignedToken}.${signature}`;
}

module.exports = {
    verifyJwt,
    derivePermissions,
    hasPermissions,
    getBearerToken,
    createRouteGuard,
    registerAuth,
    createTestToken,
};
