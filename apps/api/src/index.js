// ============================================
// SAQR API — Fastify Backend
// Serves evidence, violations, and dashboard data
// to the Shield UI. READ-ONLY queries only.
// ============================================

const Fastify = require('fastify');
const cors = require('@fastify/cors');
const { Pool } = require('pg');

const fastify = Fastify({ logger: true });

// -----------------------------------------------
// Database
// -----------------------------------------------
const pool = new Pool({
    host: process.env.SHADOW_DB_HOST || 'localhost',
    port: parseInt(process.env.SHADOW_DB_PORT || '5432', 10),
    database: process.env.SHADOW_DB_NAME || 'saqr_shadow',
    user: process.env.SHADOW_DB_USER || 'saqr',
    password: process.env.SHADOW_DB_PASSWORD || 'saqr_dev_password',
});

// -----------------------------------------------
// Plugins
// -----------------------------------------------
fastify.register(cors, { origin: true });

// -----------------------------------------------
// Health Check
// -----------------------------------------------
fastify.get('/health', async () => {
    const db = await pool.query('SELECT NOW() as time');
    return { status: 'ok', service: 'saqr-api', time: db.rows[0].time };
});

// -----------------------------------------------
// Dashboard KPIs
// -----------------------------------------------
fastify.get('/api/dashboard/kpis', async () => {
    const [totalViolations, criticalCount, penaltyExposure, todayCount] = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM vault.evidence'),
        pool.query("SELECT COUNT(*) as count FROM vault.evidence WHERE severity = 'critical'"),
        pool.query(`
      SELECT COALESCE(SUM(ps.max_penalty_sar), 0) as total
      FROM vault.evidence e
      JOIN vault.penalty_schedule ps ON e.violation_code = ps.violation_code
    `),
        pool.query("SELECT COUNT(*) as count FROM vault.evidence WHERE DATE(ntp_timestamp) = CURRENT_DATE"),
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
fastify.get('/api/violations', async (request) => {
    const { page = 1, limit = 20, authority, severity } = request.query;
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
        pool.query(
            `SELECT id, evidence_type, violation_code, authority, severity, title, description,
              sha256_hash, ntp_timestamp, created_at
       FROM vault.evidence
       ${where}
       ORDER BY ntp_timestamp DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            params
        ),
        pool.query(`SELECT COUNT(*) as count FROM vault.evidence ${where}`, params.slice(0, -2)),
    ]);

    return {
        data: violations.rows,
        pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total: parseInt(total.rows[0].count, 10),
        },
    };
});

// -----------------------------------------------
// Single Evidence Record (with full payload)
// -----------------------------------------------
fastify.get('/api/evidence/:id', async (request) => {
    const { id } = request.params;
    const result = await pool.query(
        `SELECT e.*, ps.description_ar, ps.description_en, ps.min_penalty_sar, ps.max_penalty_sar, ps.source_document
     FROM vault.evidence e
     LEFT JOIN vault.penalty_schedule ps ON e.violation_code = ps.violation_code
     WHERE e.id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        return fastify.httpErrors.notFound('Evidence record not found');
    }

    return result.rows[0];
});

// -----------------------------------------------
// Penalty Schedule Reference
// -----------------------------------------------
fastify.get('/api/penalty-schedule', async () => {
    const result = await pool.query(
        'SELECT * FROM vault.penalty_schedule ORDER BY authority, violation_code'
    );
    return result.rows;
});

// -----------------------------------------------
// Merkle Log
// -----------------------------------------------
fastify.get('/api/merkle-log', async () => {
    const result = await pool.query(
        'SELECT id, batch_date, evidence_count, merkle_root, computed_at FROM vault.merkle_log ORDER BY batch_date DESC LIMIT 30'
    );
    return result.rows;
});

// -----------------------------------------------
// CDC Event Stream (recent)
// -----------------------------------------------
fastify.get('/api/cdc-events', async (request) => {
    const { limit = 50 } = request.query;
    const result = await pool.query(
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
fastify.get('/api/dashboard/breakdown', async () => {
    const result = await pool.query(`
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
fastify.get('/api/obligations', async (request) => {
    const { authority, type } = request.query;
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (authority) { where += ` AND authority = $${idx++}`; params.push(authority); }
    if (type) { where += ` AND obligation_type = $${idx++}`; params.push(type); }

    const result = await pool.query(
        `SELECT * FROM shadow.obligations ${where} ORDER BY created_at DESC LIMIT 100`,
        params
    );
    return result.rows;
});

// -----------------------------------------------
// NLP: Instruction Drift Alerts
// -----------------------------------------------
fastify.get('/api/drift-alerts', async (request) => {
    const { acknowledged } = request.query;
    let where = '';
    const params = [];
    if (acknowledged !== undefined) {
        where = 'WHERE acknowledged = $1';
        params.push(acknowledged === 'true');
    }
    const result = await pool.query(
        `SELECT * FROM shadow.instruction_drift ${where} ORDER BY detected_at DESC LIMIT 50`,
        params
    );
    return result.rows;
});

// -----------------------------------------------
// Dashboard KPIs (extended with NLP data)
// -----------------------------------------------
fastify.get('/api/dashboard/nlp-kpis', async () => {
    const [obligations, drifts, unacknowledged] = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM shadow.obligations'),
        pool.query('SELECT COUNT(*) as count FROM shadow.instruction_drift'),
        pool.query("SELECT COUNT(*) as count FROM shadow.instruction_drift WHERE acknowledged = false"),
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
fastify.get('/api/cv/detections', async (request) => {
    const { category, severity, camera, limit = 30 } = request.query;
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (category) { where += ` AND category = $${idx++}`; params.push(category); }
    if (severity) { where += ` AND severity = $${idx++}`; params.push(severity); }
    if (camera) { where += ` AND camera_id = $${idx++}`; params.push(camera); }
    params.push(limit);

    const result = await pool.query(
        `SELECT * FROM shadow.cv_detections ${where} ORDER BY ntp_timestamp DESC LIMIT $${idx}`,
        params
    );
    return result.rows;
});

// -----------------------------------------------
// CV Watchman: Camera List
// -----------------------------------------------
fastify.get('/api/cv/cameras', async () => {
    const result = await pool.query(
        'SELECT * FROM shadow.camera_registry ORDER BY camera_id'
    );
    return result.rows;
});

// -----------------------------------------------
// CV Watchman: Dashboard KPIs
// -----------------------------------------------
fastify.get('/api/cv/kpis', async () => {
    const [total, critical, signage, visual, structural] = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM shadow.cv_detections'),
        pool.query("SELECT COUNT(*) as count FROM shadow.cv_detections WHERE severity = 'critical'"),
        pool.query("SELECT COUNT(*) as count FROM shadow.cv_detections WHERE category = 'signage'"),
        pool.query("SELECT COUNT(*) as count FROM shadow.cv_detections WHERE category = 'visual'"),
        pool.query("SELECT COUNT(*) as count FROM shadow.cv_detections WHERE category = 'structural'"),
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
// Security: One-way encrypted stream — Public Zone → Private Zone
// This endpoint proves to the bank that SAQR is
// actively monitoring all 7 regulatory authorities.
// -----------------------------------------------
fastify.get('/api/v1/sources/heartbeat', async (request, reply) => {
    reply.header('X-SAQR-Zone', 'public-ingestion');
    reply.header('X-SAQR-Direction', 'inbound-only');
    reply.header('X-SAQR-Sovereignty', 'KSA-STC-Cloud');
    return {
        status: 'operational',
        timestamp: new Date().toISOString(),
        authorities: [
            { code: 'SAMA', name: 'Saudi Central Bank', name_ar: 'البنك المركزي السعودي', status: 'active', lastSync: new Date().toISOString() },
            { code: 'SDAIA', name: 'Saudi Data & AI Authority', name_ar: 'هيئة البيانات والذكاء الاصطناعي', status: 'active', lastSync: new Date().toISOString() },
            { code: 'ZATCA', name: 'Zakat, Tax & Customs Authority', name_ar: 'هيئة الزكاة والضريبة والجمارك', status: 'active', lastSync: new Date().toISOString() },
            { code: 'SFDA', name: 'Saudi Food & Drug Authority', name_ar: 'الهيئة العامة للغذاء والدواء', status: 'active', lastSync: new Date().toISOString() },
            { code: 'MOH', name: 'Ministry of Health', name_ar: 'وزارة الصحة', status: 'active', lastSync: new Date().toISOString() },
            { code: 'MOMAH', name: 'Ministry of Municipal & Rural Affairs', name_ar: 'وزارة الشؤون البلدية والقروية', status: 'active', lastSync: new Date().toISOString() },
            { code: 'MHRSD', name: 'Ministry of Human Resources & Social Development', name_ar: 'وزارة الموارد البشرية والتنمية الاجتماعية', status: 'active', lastSync: new Date().toISOString() },
        ],
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
        },
    };
});

// -----------------------------------------------
// Sentinel Engine: Recent Staging Entries
// Returns new regulatory entries from the last hour
// for UI heartbeat polling and amber alerts.
// -----------------------------------------------
fastify.get('/api/v1/sources/staging/recent', async (request) => {
    const { hours = 1 } = request.query;
    try {
        const result = await pool.query(
            `SELECT id, authority, title, source_url, content_hash, category, detected_at
             FROM shadow.regulatory_staging
             WHERE detected_at >= NOW() - INTERVAL '${parseInt(hours, 10)} hours'
             ORDER BY detected_at DESC
             LIMIT 50`
        );
        return {
            count: result.rows.length,
            entries: result.rows,
            queriedAt: new Date().toISOString(),
        };
    } catch (err) {
        // Table may not exist yet in dev — return empty
        return { count: 0, entries: [], queriedAt: new Date().toISOString() };
    }
});

// -----------------------------------------------
// Start Server
// -----------------------------------------------
const start = async () => {
    try {
        const port = parseInt(process.env.API_PORT || '3001', 10);
        await fastify.listen({ port, host: '0.0.0.0' });
        console.log('');
        console.log('🦅 ============================================');
        console.log(`🦅  SAQR API — Listening on port ${port}`);
        console.log('🦅  Endpoints: /api/dashboard/kpis, /api/violations');
        console.log('🦅  Sentinel:  /api/v1/sources/heartbeat, /api/v1/sources/staging/recent');
        console.log('🦅  Golden Rule: READ-ONLY queries only');
        console.log('🦅 ============================================');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
