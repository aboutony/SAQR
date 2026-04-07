# SAQR Phase 1: Schema Versioning and Data Contracts

Date: 2026-04-07
Scope: `P1-501`

## Outcome

Phase 1 now includes an explicit schema-governance package for the production-ready environment. This closes the gap between the current repo schema files and a delivery-team handoff model that can be versioned, reviewed, and migrated safely without touching the frozen demo environment.

## Artifacts

- Migration ledger bootstrap: `infra/migrations/0001_platform_schema_migrations.sql`
- Migration operating procedure: `infra/migrations/README.md`
- Machine-readable schema/versioning manifest: `docs/contracts/saqr-schema-versioning.yaml`
- Human-readable data dictionary: `docs/contracts/saqr-data-dictionary.md`

## What Was Defined

1. A dedicated `platform.schema_migrations` ledger for recording migration identity, checksum, compatibility level, execution mode, and operator metadata.
2. A forward-only migration strategy for Phase 1, with additive changes preferred and immutable evidence-path rollbacks explicitly disallowed.
3. Formal schema ownership and mutation boundaries across the `public`, `shadow`, `vault`, and `platform` schemas.
4. Table-level business keys and reader/writer expectations for the current production-ready service surface.

## Delivery-Team Guidance

- Apply schema changes only to the production-ready environment unless there is explicit approval to touch demo data.
- Update both the data dictionary and schema-versioning manifest whenever a table or column contract changes.
- Treat `vault.evidence` and `vault.merkle_log` as immutable legal-integrity records.
- Use forward-fix migrations instead of destructive rollback when a rollout goes wrong.

## Scope Notes

- No UI or UX files were changed in this phase.
- This repo still does not include a live migration runner by design. The delivery team remains responsible for target-environment execution with free tooling.
