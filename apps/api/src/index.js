// ============================================
// SAQR API — Fastify Backend
// Serves evidence, violations, and dashboard data
// to the Shield UI. READ-ONLY queries only.
// ============================================

const Fastify = require('fastify');
const cors = require('@fastify/cors');
const { randomUUID } = require('crypto');
const { Pool } = require('pg');
const { buildPlatformConfig, resolveSourceAuthorities } = require('./platform-config');
const { registerAuth } = require('./auth');
const { createServiceLogger, installProcessHandlers } = require('../../../shared/observability');
const { createPostgresAdapter } = require('../../../shared/postgres-adapter');

const config = buildPlatformConfig(process.env);
const logger = createServiceLogger({ service: 'saqr-api', runtime: config.runtime });
const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
});

// -----------------------------------------------
// Database
// -----------------------------------------------
const pool = new Pool(config.db);
const db = createPostgresAdapter(pool, {
    name: 'saqr-api-db',
    logger,
});

function toPositiveInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function routeOptions(preHandler) {
    return preHandler ? { preHandler } : {};
}

function requestPath(request) {
    return request.routeOptions?.url || request.url;
}

// -----------------------------------------------
// Plugins
// -----------------------------------------------
fastify.register(cors, {
    origin: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
});
registerAuth(fastify, config.auth);
fastify.decorateRequest('requestStartedAt', 0);
fastify.decorateRequest('audit', null);

fastify.addHook('onRequest', async (request) => {
    request.requestStartedAt = Date.now();
    request.audit = (action, fields = {}) => logger.audit(action, {
        requestId: request.id,
        method: request.method,
        path: requestPath(request),
        actor: request.authContext?.subject || null,
        clientIp: request.ip,
        ...fields,
    });

    logger.debug('http.request.started', {
        requestId: request.id,
        method: request.method,
        path: requestPath(request),
        clientIp: request.ip,
    });
});

fastify.addHook('onResponse', async (request, reply) => {
    logger.info('http.request.completed', {
        requestId: request.id,
        method: request.method,
        path: requestPath(request),
        statusCode: reply.statusCode,
        durationMs: Date.now() - request.requestStartedAt,
        actor: request.authContext?.subject || null,
    });
});

fastify.setErrorHandler((error, request, reply) => {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    logger.error('http.request.failed', error, {
        requestId: request.id,
        method: request.method,
        path: requestPath(request),
        statusCode,
        actor: request.authContext?.subject || null,
    });

    if (reply.sent) return;

    if (statusCode >= 500) {
        return reply.code(statusCode).send({
            error: 'INTERNAL_ERROR',
            message: 'Internal server error',
        });
    }

    return reply.code(statusCode).send({
        error: error.code || 'REQUEST_ERROR',
        message: error.message,
    });
});

// -----------------------------------------------
// Health Check
// -----------------------------------------------
fastify.get('/health', async () => {
    const result = await db.query('SELECT NOW() as time');
    return {
        status: 'ok',
        service: 'saqr-api',
        runtimeMode: config.runtime.mode,
        time: result.rows[0].time,
    };
});

// -----------------------------------------------
// Platform Runtime
// -----------------------------------------------
fastify.get('/api/platform/runtime', {
    preHandler: fastify.requireAuth({ permissions: ['saqr.read'] }),
}, async () => {
    return {
        runtime: config.runtime,
        auth: {
            enabled: config.auth.enabled,
            issuer: config.auth.issuer,
            audience: config.auth.audience,
        },
        sources: {
            heartbeatPublic: config.sources.heartbeatPublic,
            authorities: config.sources.authorities,
        },
    };
});

// -----------------------------------------------
// Dashboard KPIs
// -----------------------------------------------
fastify.get('/api/dashboard/kpis', {
    preHandler: fastify.requireAuth({ permissions: ['dashboard.read'] }),
}, async () => {
    const [totalViolations, criticalCount, penaltyExposure, todayCount] = await Promise.all([
        db.query('SELECT COUNT(*) as count FROM vault.evidence'),
        db.query("SELECT COUNT(*) as count FROM vault.evidence WHERE severity = 'critical'"),
        db.query(`
      SELECT COALESCE(SUM(ps.max_penalty_sar), 0) as total
      FROM vault.evidence e
      JOIN vault.penalty_schedule ps ON e.violation_code = ps.violation_code
    `),
        db.query("SELECT COUNT(*) as count FROM vault.evidence WHERE DATE(ntp_timestamp) = CURRENT_DATE"),
    ]);

    return {
        totalViolationsIntercepted: parseInt(totalViolations.rows[0].count, 10),
        criticalViolations: parseInt(criticalCount.rows[0].count, 10),
        projectedPenaltyExposure: parseFloat(penaltyExposure.rows[0].total),
        todayInterceptions: parseInt(todayCount.rows[0].count, 10),
    };
});

// -----------------------------------------------
// Recent Violations (paginated)
// -----------------------------------------------
fastify.get('/api/violations', {
    preHandler: fastify.requireAuth({ permissions: ['violations.read'] }),
}, async (request) => {
    const page = toPositiveInt(request.query.page, 1);
    const limit = toPositiveInt(request.query.limit, 20, { min: 1, max: 100 });
    const { authority, severity } = request.query;
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (authority) {
        where += ` AND authority = $${paramIdx++}`;
        params.push(authority);
    }
    if (severity) {
        where += ` AND severity = $${paramIdx++}`;
        params.push(severity);
    }

    params.push(limit, offset);

    const [violations, total] = await Promise.all([
        db.query(
            `SELECT id, evidence_type, violation_code, authority, severity, title, description,
              sha256_hash, ntp_timestamp, created_at
       FROM vault.evidence
       ${where}
       ORDER BY ntp_timestamp DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            params
        ),
        db.query(`SELECT COUNT(*) as count FROM vault.evidence ${where}`, params.slice(0, -2)),
    ]);

    return {
        data: violations.rows,
        pagination: {
            page,
            limit,
            total: parseInt(total.rows[0].count, 10),
        },
    };
});

// -----------------------------------------------
// Single Evidence Record (with full payload)
// -----------------------------------------------
fastify.get('/api/evidence/:id', {
    preHandler: fastify.requireAuth({ permissions: ['evidence.read'] }),
}, async (request, reply) => {
    const { id } = request.params;
    const result = await db.query(
        `SELECT e.*, ps.description_ar, ps.description_en, ps.min_penalty_sar, ps.max_penalty_sar, ps.source_document
     FROM vault.evidence e
     LEFT JOIN vault.penalty_schedule ps ON e.violation_code = ps.violation_code
     WHERE e.id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        return reply.code(404).send({
            error: 'NOT_FOUND',
            message: 'Evidence record not found',
        });
    }

    request.audit('data.evidence_read', {
        resourceType: 'evidence',
        resourceId: id,
        authority: result.rows[0].authority,
        violationCode: result.rows[0].violation_code,
    });

    return result.rows[0];
});

// -----------------------------------------------
// Penalty Schedule Reference
// -----------------------------------------------
fastify.get('/api/penalty-schedule', {
    preHandler: fastify.requireAuth({ permissions: ['references.read'] }),
}, async () => {
    const result = await db.query(
        'SELECT * FROM vault.penalty_schedule ORDER BY authority, violation_code'
    );
    return result.rows;
});

// -----------------------------------------------
// Merkle Log
// -----------------------------------------------
fastify.get('/api/merkle-log', {
    preHandler: fastify.requireAuth({ permissions: ['evidence.read'] }),
}, async () => {
    const result = await db.query(
        'SELECT id, batch_date, evidence_count, merkle_root, computed_at FROM vault.merkle_log ORDER BY batch_date DESC LIMIT 30'
    );
    return result.rows;
});

// -----------------------------------------------
// CDC Event Stream (recent)
// -----------------------------------------------
fastify.get('/api/cdc-events', {
    preHandler: fastify.requireAuth({ permissions: ['cdc.read'] }),
}, async (request) => {
    const limit = toPositiveInt(request.query.limit, 50, { min: 1, max: 500 });
    const result = await db.query(
        `SELECT id, source_system, source_table, operation, event_timestamp, ingested_at, sha256_hash
     FROM shadow.cdc_events
     ORDER BY ingested_at DESC
     LIMIT $1`,
        [limit]
    );
    return result.rows;
});

// -----------------------------------------------
// Violation Breakdown by Authority
// -----------------------------------------------
fastify.get('/api/dashboard/breakdown', {
    preHandler: fastify.requireAuth({ permissions: ['dashboard.read'] }),
}, async () => {
    const result = await db.query(`
    SELECT authority,
           severity,
           COUNT(*) as count,
           COALESCE(SUM(ps.max_penalty_sar), 0) as max_exposure
    FROM vault.evidence e
    LEFT JOIN vault.penalty_schedule ps ON e.violation_code = ps.violation_code
    GROUP BY authority, severity
    ORDER BY authority, severity
  `);
    return result.rows;
});

// -----------------------------------------------
// NLP: Obligations
// -----------------------------------------------
fastify.get('/api/obligations', {
    preHandler: fastify.requireAuth({ permissions: ['nlp.read'] }),
}, async (request) => {
    const { authority, type } = request.query;
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (authority) { where += ` AND authority = $${idx++}`; params.push(authority); }
    if (type) { where += ` AND obligation_type = $${idx++}`; params.push(type); }

    const result = await db.query(
        `SELECT * FROM shadow.obligations ${where} ORDER BY created_at DESC LIMIT 100`,
        params
    );
    return result.rows;
});

// -----------------------------------------------
// NLP: Instruction Drift Alerts
// -----------------------------------------------
fastify.get('/api/drift-alerts', {
    preHandler: fastify.requireAuth({ permissions: ['nlp.read'] }),
}, async (request) => {
    const { acknowledged } = request.query;
    let where = '';
    const params = [];
    if (acknowledged !== undefined) {
        where = 'WHERE acknowledged = $1';
        params.push(acknowledged === 'true');
    }
    const result = await db.query(
        `SELECT * FROM shadow.instruction_drift ${where} ORDER BY detected_at DESC LIMIT 50`,
        params
    );
    return result.rows;
});

// -----------------------------------------------
// Dashboard KPIs (extended with NLP data)
// -----------------------------------------------
fastify.get('/api/dashboard/nlp-kpis', {
    preHandler: fastify.requireAuth({ permissions: ['dashboard.read', 'nlp.read'] }),
}, async () => {
    const [obligations, drifts, unacknowledged] = await Promise.all([
        db.query('SELECT COUNT(*) as count FROM shadow.obligations'),
        db.query('SELECT COUNT(*) as count FROM shadow.instruction_drift'),
        db.query("SELECT COUNT(*) as count FROM shadow.instruction_drift WHERE acknowledged = false"),
    ]);
    return {
        totalObligations: parseInt(obligations.rows[0].count, 10),
        totalDriftAlerts: parseInt(drifts.rows[0].count, 10),
        unacknowledgedAlerts: parseInt(unacknowledged.rows[0].count, 10),
    };
});

// -----------------------------------------------
// CV Watchman: Detections Gallery
// -----------------------------------------------
fastify.get('/api/cv/detections', {
    preHandler: fastify.requireAuth({ permissions: ['cv.read'] }),
}, async (request) => {
    const { category, severity, camera } = request.query;
    const limit = toPositiveInt(request.query.limit, 30, { min: 1, max: 100 });
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (category) { where += ` AND category = $${idx++}`; params.push(category); }
    if (severity) { where += ` AND severity = $${idx++}`; params.push(severity); }
    if (camera) { where += ` AND camera_id = $${idx++}`; params.push(camera); }
    params.push(limit);

    const result = await db.query(
        `SELECT * FROM shadow.cv_detections ${where} ORDER BY ntp_timestamp DESC LIMIT $${idx}`,
        params
    );
    return result.rows;
});

// -----------------------------------------------
// CV Watchman: Camera List
// -----------------------------------------------
fastify.get('/api/cv/cameras', {
    preHandler: fastify.requireAuth({ permissions: ['cv.read'] }),
}, async () => {
    const result = await db.query(
        'SELECT * FROM shadow.camera_registry ORDER BY camera_id'
    );
    return result.rows;
});

// -----------------------------------------------
// CV Watchman: Dashboard KPIs
// -----------------------------------------------
fastify.get('/api/cv/kpis', {
    preHandler: fastify.requireAuth({ permissions: ['dashboard.read', 'cv.read'] }),
}, async () => {
    const [total, critical, signage, visual, structural] = await Promise.all([
        db.query('SELECT COUNT(*) as count FROM shadow.cv_detections'),
        db.query("SELECT COUNT(*) as count FROM shadow.cv_detections WHERE severity = 'critical'"),
        db.query("SELECT COUNT(*) as count FROM shadow.cv_detections WHERE category = 'signage'"),
        db.query("SELECT COUNT(*) as count FROM shadow.cv_detections WHERE category = 'visual'"),
        db.query("SELECT COUNT(*) as count FROM shadow.cv_detections WHERE category = 'structural'"),
    ]);
    return {
        totalDetections: parseInt(total.rows[0].count, 10),
        criticalDetections: parseInt(critical.rows[0].count, 10),
        signageViolations: parseInt(signage.rows[0].count, 10),
        visualViolations: parseInt(visual.rows[0].count, 10),
        structuralViolations: parseInt(structural.rows[0].count, 10),
    };
});

// -----------------------------------------------
// Sovereign Bridge: Public Rule Ingestion Heartbeat
// -----------------------------------------------
const heartbeatPreHandler = config.sources.heartbeatPublic
    ? null
    : fastify.requireAuth({ permissions: ['sources.read'] });

fastify.get('/api/v1/sources/heartbeat', routeOptions(heartbeatPreHandler), async (request, reply) => {
    reply.header('X-SAQR-Zone', 'public-ingestion');
    reply.header('X-SAQR-Direction', 'inbound-only');
    reply.header('X-SAQR-Sovereignty', 'KSA-STC-Cloud');
    return {
        status: 'operational',
        timestamp: new Date().toISOString(),
        runtimeMode: config.runtime.mode,
        authorities: resolveSourceAuthorities(config.sources.authorities),
        sovereignty: {
            zone: 'KSA',
            cloud: 'STC',
            encryption: 'TLS 1.3 + AES-256-GCM',
            dataResidency: 'Kingdom of Saudi Arabia',
            compliance: ['PDPL', 'SDAIA', 'NCA'],
        },
        security: {
            direction: 'inbound-only',
            description: 'Public Rule Ingestion is a one-way encrypted stream into the Private Zone. No client data exits.',
            authRequired: !config.sources.heartbeatPublic,
        },
    };
});

// -----------------------------------------------
// Sentinel Engine: Recent Staging Entries
// -----------------------------------------------
fastify.get('/api/v1/sources/staging/recent', {
    preHandler: fastify.requireAuth({ permissions: ['sources.read'] }),
}, async (request) => {
    const hours = toPositiveInt(request.query.hours, 1, { min: 1, max: 24 });
    request.audit('sources.staging_read', {
        hours,
    });
    try {
        const result = await db.query(
            `SELECT id, authority, title, source_url, content_hash, category, detected_at
             FROM shadow.regulatory_staging
             WHERE detected_at >= NOW() - ($1 * INTERVAL '1 hour')
             ORDER BY detected_at DESC
             LIMIT 50`,
            [hours]
        );
        return {
            count: result.rows.length,
            entries: result.rows,
            queriedAt: new Date().toISOString(),
        };
    } catch (err) {
        return { count: 0, entries: [], queriedAt: new Date().toISOString() };
    }
});

// -----------------------------------------------
// Start Server
// -----------------------------------------------
const start = async () => {
    try {
        await fastify.listen({ port: config.api.port, host: config.api.host });
        (config.warnings || []).forEach((warning) => logger.warn('startup.configuration_warning', { warning }));
        logger.info('service.startup.completed', {
            host: config.api.host,
            port: config.api.port,
            authEnabled: config.auth.enabled,
            sourceAuthorities: config.sources.authorities,
            readOnly: true,
        });
    } catch (err) {
        logger.fatal('service.startup.failed', err);
        process.exit(1);
    }
};

installProcessHandlers({
    logger,
    onShutdown: async (signal) => {
        logger.info('service.shutdown.releasing_resources', { signal });
        await fastify.close().catch(() => { });
        await db.close().catch(() => { });
    },
});

start();
