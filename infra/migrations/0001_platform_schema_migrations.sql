-- ============================================
-- SAQR Platform Schema Version Ledger
-- Phase 1 migration tracking baseline
-- ============================================

CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.schema_migrations (
    id                  BIGSERIAL PRIMARY KEY,
    migration_id        VARCHAR(120) NOT NULL UNIQUE,
    component           VARCHAR(40) NOT NULL CHECK (component IN ('source', 'shadow', 'vault', 'platform', 'contract')),
    schema_name         VARCHAR(60) NOT NULL,
    object_name         VARCHAR(200),
    checksum_sha256     CHAR(64) NOT NULL,
    execution_mode      VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (execution_mode IN ('manual', 'automated')),
    compatibility_level VARCHAR(20) NOT NULL DEFAULT 'backward' CHECK (compatibility_level IN ('backward', 'breaking', 'forward_fix')),
    applied_by          VARCHAR(200) NOT NULL DEFAULT CURRENT_USER,
    applied_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_component
    ON platform.schema_migrations(component, schema_name, applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_migration_id
    ON platform.schema_migrations(migration_id);
