# SAQR Phase 1 Component and Dependency Matrix

Date: 2026-04-07
Scope: Phase 1 delivery-team component reference

## Component Matrix

| Component | Runtime Type | Scaling Posture | Primary Inputs | Primary Outputs | External Dependencies |
|---|---|---|---|---|---|
| `apps/shield-ui` | Static UI served by Nginx | Horizontally scalable | API responses, runtime config injection | Browser UI | API endpoint |
| `apps/api` | Node.js service | Horizontally scalable | UI requests, JWT bearer tokens, shadow DB queries | Dashboard/evidence/reference responses | Shadow PostgreSQL, token issuer |
| `services/evidence-vault` | Node.js worker | Singleton by default | Kafka CDC events, NTP timestamps | Evidence rows, Merkle batches | Kafka, shadow PostgreSQL, NTP |
| `services/sentinel-scrapers` | Node.js worker with Playwright | Singleton by default | Regulatory portals | Staged regulatory entries | Regulatory portals, shadow PostgreSQL |
| `services/nlp-interpreter` | Node.js worker | Singleton by default | Staged circulars, baseline obligations | Stored obligations, drift alerts | Shadow PostgreSQL |
| `services/cv-watchman` | Node.js worker | Singleton by default | VMS frames | Evidence rows, maintenance alerts | VMS, shadow PostgreSQL |
| `services/cdc-connector` | Connector artifact | Delivery-managed | Source DB WAL stream | Kafka CDC topics | Kafka Connect, source DB |

## Runtime Contracts by Area

### UI and API

- UI remains visually frozen in Phase 1.
- API auth is server-side and production-ready aware.
- UI production deployment uses runtime config injection rather than design changes.

### Evidence and Compliance

- Evidence Vault consumes CDC-style payloads only.
- Rule evaluation is modularized and test-backed.
- Evidence sealing and Merkle generation remain read-only with respect to client source systems.

### Regulatory Intelligence

- Sentinel performs source collection and staging only.
- NLP performs parsing, extraction, and drift analysis from staged circular data.
- Current implementation scope is strongest for SAMA and SDAIA because those are the live providers presently wired in code.

### Visual Intelligence

- CV Watchman is wired through provider contracts and VMS adapters.
- Delivery owns real VMS endpoint integration and environment prerequisites.

## Operational Signals

| Component | Primary Validation Signal |
|---|---|
| `apps/shield-ui` | UI baseline check plus successful static container build |
| `apps/api` | `/health` endpoint and API test suite |
| `services/evidence-vault` | package tests, startup dependency validation, structured logs |
| `services/sentinel-scrapers` | package tests, startup DB validation in live mode, scrape/audit logs |
| `services/nlp-interpreter` | package tests, startup DB validation in production-ready mode |
| `services/cv-watchman` | package tests, startup DB/VMS validation in production-ready mode |

## Delivery Notes

- Singleton-by-default services can be scaled later only after delivery introduces coordination, partitioning, or idempotency controls where needed.
- Client-specific tenancy, sovereign topology variation, and cross-entity reporting are Phase 2 concerns, not Phase 1 documentation scope.

