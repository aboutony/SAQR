// ============================================
// SAQR Evidence Vault — Main Service
// Kafka consumer → Compliance Engine → Evidence Store
// ============================================

const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const { computeHash, hashCdcEvent, computeMerkleRoot } = require('./hasher');
const { getNtpTimestamp } = require('./ntp');
const { detectViolations } = require('./compliance-engine');

// -----------------------------------------------
// Configuration
// -----------------------------------------------
const config = {
    kafka: {
        brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092').split(','),
        clientId: 'saqr-evidence-vault',
        groupId: 'saqr-vault-consumer',
    },
    db: {
        host: process.env.SHADOW_DB_HOST || 'localhost',
        port: parseInt(process.env.SHADOW_DB_PORT || '5432', 10),
        database: process.env.SHADOW_DB_NAME || 'saqr_shadow',
        user: process.env.SHADOW_DB_USER || 'saqr',
        password: process.env.SHADOW_DB_PASSWORD || 'saqr_dev_password',
    },
    ntp: {
        server: process.env.NTP_SERVER || 'pool.ntp.org',
    },
    topics: [
        'saqr.cdc.client_banking.public.consumer_disclosures',
        'saqr.cdc.client_banking.public.fee_schedule',
        'saqr.cdc.client_banking.public.cooling_off_periods',
        'saqr.cdc.client_banking.public.branch_compliance',
    ],
};

// -----------------------------------------------
// Database Pool
// -----------------------------------------------
const pool = new Pool(config.db);

// -----------------------------------------------
// Store CDC event in shadow DB
// -----------------------------------------------
async function storeCdcEvent(event, ntpTs, hash) {
    const query = `
    INSERT INTO shadow.cdc_events
      (source_system, source_table, operation, before_state, after_state, event_timestamp, sha256_hash)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `;
    const values = [
        event.source?.db || 'unknown',
        event.source?.table || 'unknown',
        event.op === 'c' ? 'INSERT' : event.op === 'u' ? 'UPDATE' : event.op === 'd' ? 'DELETE' : event.op === 'r' ? 'INSERT' : 'UNKNOWN',
        event.before ? JSON.stringify(event.before) : null,
        event.after ? JSON.stringify(event.after) : null,
        ntpTs.timestamp,
        hash,
    ];
    const result = await pool.query(query, values);
    return result.rows[0].id;
}

// -----------------------------------------------
// Store violation evidence
// -----------------------------------------------
async function storeEvidence(violation, ntpTs) {
    const payload = {
        ...violation,
        ntp_timestamp: ntpTs.timestamp,
        ntp_source: ntpTs.source,
    };
    const hash = computeHash(payload);

    const query = `
    INSERT INTO vault.evidence
      (evidence_type, source_module, violation_code, authority, severity, title, description, raw_payload, sha256_hash, ntp_timestamp)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (sha256_hash) DO NOTHING
    RETURNING id
  `;
    const values = [
        'cdc_violation',
        'compliance-engine',
        violation.violationCode,
        violation.authority,
        violation.severity,
        violation.title,
        violation.description,
        JSON.stringify(payload),
        hash,
        ntpTs.timestamp,
    ];

    const result = await pool.query(query, values);
    if (result.rows.length > 0) {
        console.log(`🛡️  EVIDENCE SEALED — ID: ${result.rows[0].id} | ${violation.violationCode} | ${violation.title}`);
        return result.rows[0].id;
    }
    console.log(`ℹ️  Duplicate evidence skipped: ${hash.substring(0, 12)}...`);
    return null;
}

// -----------------------------------------------
// Process a single CDC message
// -----------------------------------------------
async function processMessage(message) {
    let event;
    try {
        const parsed = JSON.parse(message.value.toString());
        event = parsed.payload || parsed; // Debezium envelope
    } catch (err) {
        console.error('❌ Failed to parse CDC message:', err.message);
        return;
    }

    const table = event.source?.table;
    const operation = event.op;

    if (!table || !operation) {
        console.warn('⚠️  Skipping message with missing table/operation metadata');
        return;
    }

    // Get authoritative NTP timestamp
    const ntpTs = await getNtpTimestamp(config.ntp.server);

    // Hash the event
    const eventHash = hashCdcEvent(event, ntpTs.timestamp);

    // Store in shadow DB
    const cdcId = await storeCdcEvent(event, ntpTs, eventHash);
    console.log(`📥 CDC Event #${cdcId} | ${table} | ${operation} | hash: ${eventHash.substring(0, 12)}...`);

    // Run compliance checks
    const opMap = { c: 'INSERT', u: 'UPDATE', d: 'DELETE', r: 'INSERT' };
    const violations = detectViolations(table, opMap[operation] || operation, event.after);

    // Seal each violation into the Evidence Vault
    for (const v of violations) {
        await storeEvidence(v, ntpTs);
    }
}

// -----------------------------------------------
// Merkle batch job (daily)
// -----------------------------------------------
async function computeDailyMerkle() {
    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(
        `SELECT sha256_hash FROM vault.evidence
     WHERE DATE(ntp_timestamp) = $1
     ORDER BY id`,
        [today]
    );

    if (result.rows.length === 0) {
        console.log('📋 No evidence records for today — skipping Merkle computation.');
        return;
    }

    const hashes = result.rows.map(r => r.sha256_hash);
    const root = computeMerkleRoot(hashes);

    try {
        await pool.query(
            `INSERT INTO vault.merkle_log (batch_date, evidence_count, merkle_root, leaf_hashes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (batch_date) DO NOTHING`,
            [today, hashes.length, root, hashes]
        );
        console.log(`🌳 Merkle root for ${today}: ${root} (${hashes.length} leaves)`);
    } catch (err) {
        // The immutability trigger will block updates — that's by design
        console.log(`ℹ️  Merkle log for ${today} already sealed.`);
    }
}

// -----------------------------------------------
// Main
// -----------------------------------------------
async function main() {
    console.log('');
    console.log('🦅 ============================================');
    console.log('🦅  SAQR EVIDENCE VAULT — Starting');
    console.log('🦅  Mode: Non-Intrusive CDC Consumer');
    console.log('🦅  Hash: SHA-256 | Timestamp: NTP');
    console.log('🦅  Saudi Law of Evidence (M/43, 2022)');
    console.log('🦅 ============================================');
    console.log('');

    // Test DB connection
    try {
        await pool.query('SELECT 1');
        console.log('✅ Shadow DB connected');
    } catch (err) {
        console.error('❌ Shadow DB connection failed:', err.message);
        process.exit(1);
    }

    // Set up Kafka consumer
    const kafka = new Kafka({
        clientId: config.kafka.clientId,
        brokers: config.kafka.brokers,
    });

    const consumer = kafka.consumer({ groupId: config.kafka.groupId });

    await consumer.connect();
    console.log('✅ Kafka consumer connected');

    for (const topic of config.topics) {
        await consumer.subscribe({ topic, fromBeginning: true });
        console.log(`📡 Subscribed: ${topic}`);
    }

    // Process messages
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            try {
                await processMessage(message);
            } catch (err) {
                console.error(`❌ Error processing message from ${topic}:${partition}:`, err.message);
            }
        },
    });

    // Schedule daily Merkle computation (midnight)
    setInterval(async () => {
        try {
            await computeDailyMerkle();
        } catch (err) {
            console.error('❌ Merkle computation failed:', err.message);
        }
    }, 60 * 60 * 1000); // every hour, checks if batch needed

    console.log('');
    console.log('🦅 SAQR Evidence Vault is LIVE. Awaiting CDC events...');
    console.log('🛡️  Golden Rule: READ-ONLY. Zero writes to client systems.');
    console.log('');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🦅 Shutting down Evidence Vault...');
    await pool.end();
    process.exit(0);
});

main().catch((err) => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
