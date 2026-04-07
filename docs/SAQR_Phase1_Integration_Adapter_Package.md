# SAQR Phase 1: Integration Adapter Package

Date: 2026-04-07
Scope: `P1-502`

## Outcome

Phase 1 now includes a formal integration-adapter package for the production-ready environment. SAQR’s core logic no longer depends on raw infrastructure calls at the integration boundaries that matter most for handoff: database access, regulatory source collection, and VMS connectivity.

## Artifacts

- Shared PostgreSQL adapter: `shared/postgres-adapter.js`
- Regulatory source adapter layer: `services/sentinel-scrapers/src/source-adapters.js`
- Regulatory staging repository/ingestion adapter: `services/sentinel-scrapers/src/bridge.js`
- VMS provider registry and injectable adapter: `services/cv-watchman/src/vms/vms-adapter.js`
- Formal adapter contract reference: `docs/contracts/saqr-integration-adapters.md`

## What Changed

1. All runtime database entry points now use a shared PostgreSQL adapter contract instead of depending directly on raw `pg` pool usage.
2. Sentinel now resolves authority connectors through a provider registry and orchestrator rather than hard-coded scraper calls in the scheduler.
3. Sentinel staging persistence now has an explicit repository contract with idempotent upsert behavior.
4. CV Watchman can now accept delivery-team supplied VMS providers through an injected registry without changing the scan flow.

## Delivery-Team Guidance

- Keep the shared adapter contracts stable and replace only the underlying infrastructure implementations.
- Add new regulatory authorities by registering source providers, not by rewriting the scrape scheduler.
- Add new VMS vendors by supplying a provider registry entry that satisfies the documented contract.
- Preserve the production-ready and demo environments as separate integration planes.

## Scope Notes

- No UI or UX files were changed in this phase.
- This phase does not provision real external systems. It prepares the swappable seams the delivery team will wire in the target environment.
