# SAQR Phase 1 Observability and Operations

Date: 2026-04-07
Scope: `P1-303`

## Objective

Add production-ready observability, audit/event trace points, and safer operational error handling using only free tooling and repo-local code.

## Completed Result

`P1-303` is now complete.

## What Was Added

### Shared observability layer

New shared module:

- `shared/observability.js`

Capabilities:

- JSON-line structured logging to stdout/stderr
- log levels via `SAQR_LOG_LEVEL`
- optional stack inclusion via `SAQR_LOG_INCLUDE_STACKS`
- audit-event emission via `SAQR_AUDIT_LOG_ENABLED`
- shared shutdown handling for `SIGINT`, `SIGTERM`, `unhandledRejection`, and `uncaughtException`

### API observability

Updated files:

- `apps/api/src/index.js`
- `apps/api/src/auth.js`

Behavior added:

- structured request lifecycle logs
- consistent request IDs
- centralized API error handler
- auth-denial audit events
- evidence-read audit events
- source-staging-read audit events
- graceful API shutdown with pool and server cleanup

### Service observability

Updated files:

- `services/sentinel-scrapers/src/index.js`
- `services/sentinel-scrapers/src/bridge.js`
- `services/sentinel-scrapers/src/sama-scraper.js`
- `services/sentinel-scrapers/src/sdaia-scraper.js`
- `services/cv-watchman/src/index.js`
- `services/cv-watchman/src/vms/vms-adapter.js`
- `services/cv-watchman/src/vms/milestone-client.js`
- `services/cv-watchman/src/vms/genetec-client.js`
- `services/evidence-vault/src/index.js`
- `services/evidence-vault/src/ntp.js`
- `services/nlp-interpreter/src/index.js`
- `services/nlp-interpreter/src/sentinel-bridge.js`

Behavior added:

- structured startup and dependency-health logs
- structured batch/session summaries
- structured fatal-startup and scheduled-run error logs
- helper-module source collection, bridge, VMS, NTP fallback, and NLP bridge events now use the shared logger
- audit events for evidence sealing, CDC violation detection, CV detections, NLP drift detection, and Sentinel scrape sessions
- graceful shutdown behavior for runtime services

## Log Schema

All structured records now follow the same JSON-line pattern:

```json
{
  "timestamp": "2026-04-07T10:15:00.000Z",
  "level": "info",
  "service": "saqr-api",
  "runtimeMode": "production-ready",
  "event": "http.request.completed"
}
```

Common fields:

- `timestamp`
- `level`
- `service`
- `runtimeMode`
- `event`

Common optional fields:

- `requestId`
- `method`
- `path`
- `statusCode`
- `durationMs`
- `actor`
- `warning`
- `error`

## Audit/Event Trace Points

Examples now emitted by the platform:

- `audit.security.auth_denied`
- `audit.data.evidence_read`
- `audit.sources.staging_read`
- `audit.sources.scrape_session_completed`
- `audit.cv.detection_observed`
- `audit.evidence.sealed`
- `audit.cdc.violations_detected`
- `audit.evidence.merkle_batch_sealed`
- `audit.nlp.drift_detected_batch`
- `audit.nlp.drift_detected`

## Operational Error Handling Upgrades

### API

- request failures are now consistently logged with request context
- startup failures log as fatal and exit cleanly
- shutdown closes Fastify and PostgreSQL resources

### Sentinel

- scheduled scrape failures are now trapped and logged structurally
- shutdown closes the bridge DB pool when used in live mode

### CV Watchman

- scan-cycle failures are now trapped and logged
- DB persistence failures are logged with detection context
- shutdown closes the DB pool

### Evidence Vault

- CDC parse and processing failures are logged structurally
- NTP and Kafka startup issues are logged explicitly
- shutdown disconnects Kafka consumer and DB pool

### NLP Interpreter

- startup and demo-ingest failures are logged structurally
- drift-detection batches emit auditable events
- shutdown closes the DB pool

## Operations Runbook

### Startup checklist

1. Confirm runtime mode is correct: `demo` vs `production-ready`.
2. Confirm placeholder secrets and endpoints have been replaced in production-ready runtime.
3. Watch startup logs for any `startup.configuration_warning` events.
4. Confirm dependency events appear:
   - `dependency.shadow_db.connected`
   - `dependency.kafka.connected`
   - `dependency.ntp.validated`
   - `dependency.vms.connected`
   - `dependency.bridge_db.connected`

### Incident triage sequence

1. Check for `service.startup.failed`, `process.unhandled_rejection`, or `process.uncaught_exception`.
2. For API incidents, inspect `http.request.failed` and `audit.security.auth_denied`.
3. For regulatory-ingestion incidents, inspect `scrape.session.failed` and `audit.sources.scrape_session_completed`.
4. For evidence-path incidents, inspect `cdc.message_processing_failed`, `audit.evidence.sealed`, and `merkle.batch.failed`.
5. For NLP incidents, inspect `audit.nlp.drift_detected_batch` and `nlp.circular_ingestion.*`.
6. For CV incidents, inspect `cv.scan_cycle.failed`, `cv.detection_persistence_failed`, and `audit.cv.detection_observed`.

### Delivery-team guidance

- logs are stdout/stderr JSON lines and can be shipped by any free log collector
- no paid observability service is assumed in Phase 1
- if a future delivery environment uses ELK, Loki, OpenSearch, or a cloud-native free tier, these records are ready for ingestion without UI changes

## Environment Variables Added

Updated examples:

- `.env.demo.example`
- `.env.production.example`

New observability variables:

- `SAQR_LOG_LEVEL`
- `SAQR_LOG_INCLUDE_STACKS`
- `SAQR_AUDIT_LOG_ENABLED`

## Verification

### Syntax validation

- `node --check shared/observability.js`
- `node --check apps/api/src/index.js`
- `node --check services/sentinel-scrapers/src/index.js`
- `node --check services/cv-watchman/src/index.js`
- `node --check services/evidence-vault/src/index.js`
- `node --check services/nlp-interpreter/src/index.js`

### Test results

- `apps/api`: 9/9 passed
- `services/sentinel-scrapers`: 16/16 passed
- `services/cv-watchman`: 22/22 passed
- `services/evidence-vault`: 20/20 passed
- `services/nlp-interpreter`: 35/35 passed

## Remaining Note

This phase provides structured logs and audit traces inside the app codebase.

What it does not do yet:

- external metrics backend
- dashboards
- alert-routing integrations
- centralized retention policies

Those are delivery-environment concerns and can now be layered on top of the Phase 1 log schema.
