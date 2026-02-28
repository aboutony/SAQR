-- ============================================
-- SAQR Shadow Database — Evidence Vault Schema
-- Append-only, immutable evidence chain
-- ============================================

-- Shadow mirror of CDC events (read-only replica)
CREATE SCHEMA IF NOT EXISTS shadow;

CREATE TABLE shadow.cdc_events (
    id              BIGSERIAL PRIMARY KEY,
    source_system   VARCHAR(100) NOT NULL,
    source_table    VARCHAR(200) NOT NULL,
    operation       VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    before_state    JSONB,
    after_state     JSONB,
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    ingested_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sha256_hash     CHAR(64) NOT NULL
);

CREATE INDEX idx_cdc_events_source ON shadow.cdc_events(source_system, source_table);
CREATE INDEX idx_cdc_events_timestamp ON shadow.cdc_events(event_timestamp);

-- ============================================
-- Evidence Vault — Immutable Append-Only
-- ============================================

CREATE SCHEMA IF NOT EXISTS vault;

-- Core evidence records
CREATE TABLE vault.evidence (
    id              BIGSERIAL PRIMARY KEY,
    evidence_type   VARCHAR(50) NOT NULL CHECK (evidence_type IN ('cdc_violation', 'visual_audit', 'nlp_obligation', 'manual_entry')),
    source_module   VARCHAR(50) NOT NULL,
    violation_code  VARCHAR(50),
    authority       VARCHAR(20) CHECK (authority IN ('SAMA', 'MOMAH', 'SFDA', 'OTHER')),
    severity        VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    raw_payload     JSONB NOT NULL,
    sha256_hash     CHAR(64) NOT NULL UNIQUE,
    ntp_timestamp   TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prevent any UPDATE or DELETE on evidence (trigger-based immutability)
CREATE OR REPLACE FUNCTION vault.prevent_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SAQR Evidence Vault: Records are immutable. UPDATE and DELETE are prohibited.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evidence_immutable_update
    BEFORE UPDATE ON vault.evidence
    FOR EACH ROW EXECUTE FUNCTION vault.prevent_mutation();

CREATE TRIGGER evidence_immutable_delete
    BEFORE DELETE ON vault.evidence
    FOR EACH ROW EXECUTE FUNCTION vault.prevent_mutation();

CREATE INDEX idx_evidence_authority ON vault.evidence(authority);
CREATE INDEX idx_evidence_severity ON vault.evidence(severity);
CREATE INDEX idx_evidence_timestamp ON vault.evidence(ntp_timestamp);
CREATE INDEX idx_evidence_violation ON vault.evidence(violation_code);

-- Merkle log — daily batch hash roots
CREATE TABLE vault.merkle_log (
    id              BIGSERIAL PRIMARY KEY,
    batch_date      DATE NOT NULL UNIQUE,
    evidence_count  INTEGER NOT NULL,
    merkle_root     CHAR(64) NOT NULL,
    leaf_hashes     TEXT[] NOT NULL,
    computed_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER merkle_immutable_update
    BEFORE UPDATE ON vault.merkle_log
    FOR EACH ROW EXECUTE FUNCTION vault.prevent_mutation();

CREATE TRIGGER merkle_immutable_delete
    BEFORE DELETE ON vault.merkle_log
    FOR EACH ROW EXECUTE FUNCTION vault.prevent_mutation();

-- Penalty schedule reference (from SAMA/MOMAH regulations)
CREATE TABLE vault.penalty_schedule (
    id              SERIAL PRIMARY KEY,
    authority       VARCHAR(20) NOT NULL CHECK (authority IN ('SAMA', 'MOMAH', 'SFDA')),
    violation_code  VARCHAR(50) NOT NULL UNIQUE,
    description_ar  TEXT NOT NULL,
    description_en  TEXT,
    min_penalty_sar DECIMAL(12,2) NOT NULL DEFAULT 0,
    max_penalty_sar DECIMAL(12,2) NOT NULL,
    effective_date  DATE NOT NULL,
    source_document VARCHAR(500),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed penalty schedule with key SAMA/MOMAH violations
INSERT INTO vault.penalty_schedule (authority, violation_code, description_ar, description_en, min_penalty_sar, max_penalty_sar, effective_date, source_document) VALUES
    ('SAMA', 'SAMA-CP-001', 'عدم الإفصاح بحجم خط لا يقل عن 14 نقطة', 'Disclosure font size below 14pt minimum', 50000, 500000, '2026-01-01', 'SAMA Consumer Protection Principles 2026'),
    ('SAMA', 'SAMA-CP-002', 'تجاوز الحد الأقصى للرسوم المعتمدة', 'Exceeding approved fee caps', 100000, 1000000, '2026-01-01', 'SAMA Fee Schedule Circular 2026'),
    ('SAMA', 'SAMA-CP-003', 'عدم احترام فترة التراجع', 'Cooling-off period violation', 50000, 750000, '2026-01-01', 'SAMA Consumer Protection Principles 2026'),
    ('MOMAH', 'MOMAH-BR-001', 'لوحات إعلانية غير مطابقة', 'Non-compliant signage', 10000, 500000, '2026-01-01', 'MOMAH 2026 Penalty Schedule'),
    ('MOMAH', 'MOMAH-BR-002', 'إضاءة غير مطابقة للمعايير', 'Non-compliant lighting', 10000, 250000, '2026-01-01', 'MOMAH 2026 Penalty Schedule'),
    ('MOMAH', 'MOMAH-BR-003', 'رخصة تجارية منتهية الصلاحية', 'Expired commercial license', 50000, 2000000, '2026-01-01', 'MOMAH 2026 Penalty Schedule');

-- ============================================
-- NLP Interpreter — Obligations & Drift
-- ============================================

CREATE TABLE shadow.obligations (
    id              BIGSERIAL PRIMARY KEY,
    obligation_id   VARCHAR(50) NOT NULL UNIQUE,
    document_id     VARCHAR(100) NOT NULL,
    authority       VARCHAR(20) NOT NULL CHECK (authority IN ('SAMA', 'MOMAH', 'SFDA')),
    article         VARCHAR(50),
    obligation_text TEXT NOT NULL,
    obligation_type VARCHAR(30) NOT NULL CHECK (obligation_type IN ('prohibition', 'requirement', 'threshold', 'deadline')),
    parameters      JSONB DEFAULT '{}',
    severity        VARCHAR(20) NOT NULL DEFAULT 'mandatory',
    confidence      DECIMAL(3,2) NOT NULL DEFAULT 0.85,
    source_section  VARCHAR(50),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_obligations_authority ON shadow.obligations(authority);
CREATE INDEX idx_obligations_type ON shadow.obligations(obligation_type);

CREATE TABLE shadow.instruction_drift (
    id                    BIGSERIAL PRIMARY KEY,
    alert_id              VARCHAR(50) NOT NULL UNIQUE,
    drift_type            VARCHAR(30) NOT NULL CHECK (drift_type IN ('added', 'removed', 'modified', 'parameter_change')),
    authority             VARCHAR(20) NOT NULL,
    severity              VARCHAR(20) NOT NULL DEFAULT 'high',
    title                 VARCHAR(500) NOT NULL,
    description           TEXT,
    previous_obligation   JSONB,
    new_obligation        JSONB,
    parameter_diff        JSONB DEFAULT '{}',
    detected_at           TIMESTAMP WITH TIME ZONE NOT NULL,
    acknowledged          BOOLEAN DEFAULT false,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_drift_authority ON shadow.instruction_drift(authority);
CREATE INDEX idx_drift_severity ON shadow.instruction_drift(severity);
CREATE INDEX idx_drift_detected ON shadow.instruction_drift(detected_at);

-- ============================================
-- CV Watchman — Visual Detections
-- ============================================

CREATE TABLE shadow.cv_detections (
    id              BIGSERIAL PRIMARY KEY,
    evidence_id     VARCHAR(100) NOT NULL UNIQUE,
    camera_id       VARCHAR(100) NOT NULL,
    source          VARCHAR(30) NOT NULL,
    violation_code  VARCHAR(50) NOT NULL,
    category        VARCHAR(30) NOT NULL CHECK (category IN ('signage', 'visual', 'structural')),
    confidence      DECIMAL(4,3) NOT NULL,
    bbox            JSONB NOT NULL DEFAULT '{}',
    frame_hash      CHAR(64) NOT NULL,
    detection_hash  CHAR(64) NOT NULL,
    ntp_timestamp   TIMESTAMP WITH TIME ZONE NOT NULL,
    severity        VARCHAR(20) NOT NULL,
    name_en         VARCHAR(200),
    name_ar         VARCHAR(200),
    record_type     VARCHAR(20) NOT NULL DEFAULT 'before',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cv_camera ON shadow.cv_detections(camera_id);
CREATE INDEX idx_cv_violation ON shadow.cv_detections(violation_code);
CREATE INDEX idx_cv_severity ON shadow.cv_detections(severity);
CREATE INDEX idx_cv_timestamp ON shadow.cv_detections(ntp_timestamp);

CREATE TABLE shadow.camera_registry (
    id              SERIAL PRIMARY KEY,
    camera_id       VARCHAR(100) NOT NULL UNIQUE,
    name            VARCHAR(500) NOT NULL,
    vms_type        VARCHAR(30) NOT NULL CHECK (vms_type IN ('milestone', 'genetec', 'demo')),
    site_name       VARCHAR(200),
    zone            VARCHAR(100),
    enabled         BOOLEAN DEFAULT true,
    last_frame_at   TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
