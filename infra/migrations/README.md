# SAQR Migration Strategy

Date: 2026-04-07
Scope: Phase 1 `P1-501`

## Purpose

This folder defines the delivery-team migration process for SAQR production-ready environments.

## Baseline

Current baseline schema sources:

- `infra/source-init/01-schema.sql`
- `infra/init-scripts/01-evidence-vault.sql`

Migration ledger bootstrap:

- `infra/migrations/0001_platform_schema_migrations.sql`

## Migration Rules

1. Treat the demo environment as frozen. Do not run schema migrations against the demo dataset unless there is explicit approval.
2. Treat the production-ready environment as the only migration target in Phase 1.
3. Use forward-only migrations by default.
4. Prefer additive schema changes:
   - add tables
   - add nullable columns
   - add indexes
   - add new constraints only after compatibility review
5. Do not rename or drop columns/tables in the same release where code still reads them.
6. For immutable evidence tables, never use data-destructive rollback logic.
7. If a migration fails after partial rollout, use a forward-fix migration instead of manual drift.

## Naming Convention

Recommended filename pattern:

- `VYYYYMMDDHHMM__short_description.sql`

Example:

- `V202604071230__add_shadow_document_registry.sql`

## Required Deliverables Per Migration

Every production migration must include:

1. SQL migration file
2. SHA-256 checksum recorded in `platform.schema_migrations`
3. update to `docs/contracts/saqr-data-dictionary.md` if contracts change
4. update to `docs/contracts/saqr-schema-versioning.yaml`
5. compatibility note in the migration PR or handoff note

## Compatibility Policy

### Safe in Phase 1

- adding new tables
- adding new indexes
- adding nullable fields
- adding new enum/check values only when old readers remain valid

### Requires coordinated release

- changing column meaning
- tightening nullability
- changing key structure
- changing JSON payload shape consumed by API/services

### Not allowed without explicit approval

- dropping evidence records
- mutating `vault.evidence`
- mutating `vault.merkle_log`
- destructive rollback on immutable tables

## Recommended Apply Order

1. Platform ledger migration
2. Source schema changes
3. Shadow/vault schema changes
4. Connector/topic compatibility updates
5. Service rollout that reads the new schema

## Rollback Policy

- For source/shadow/vault schema issues, prefer a new forward-fix migration.
- For read-path issues, deploy code that tolerates both old and new schema until data migration completes.
- For immutable evidence-path issues, quarantine downstream processing and repair with additive corrections only.

## Delivery-Team Notes

- This repo does not include a live migration runner by design.
- Phase 1 uses SQL artifacts plus documented process so the delivery team can apply them in the target environment with free tooling.
