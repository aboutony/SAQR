# SAQR Phase 1 Operations Runbook

Date: 2026-04-07
Scope: Phase 1 delivery-team operating guide

## Purpose

This runbook describes the minimum safe operating flow for the production-ready SAQR package after Phase 1.

## Before Startup

1. Confirm the intended runtime mode is `production` or `production-ready`.
2. Confirm `.env.production.example` has been replaced by delivery-owned environment values, not committed secrets.
3. Confirm client prerequisites exist outside this repository:
   - shadow PostgreSQL
   - Kafka and Kafka Connect / Debezium
   - token issuer
   - VMS connectivity
   - ingress, DNS, and TLS where relevant
4. Run `npm run phase1:quality:ci` if the package changed since the last validated build.

## Recommended Startup Order

1. Provision or confirm external prerequisites.
2. Validate compose or Kubernetes config from the delivery packaging.
3. Start `apps/api`.
4. Start worker services:
   - `services/evidence-vault`
   - `services/sentinel-scrapers`
   - `services/nlp-interpreter`
   - `services/cv-watchman`
5. Start `apps/shield-ui`.

## Validation Steps

### Repo-Level Validation

- `npm run phase1:bootstrap`
- `npm run phase1:quality`
- `npm run phase1:release:verify -- --build-containers` for release candidates

### Runtime Validation

- API health: `GET /health`
- UI baseline: `npm run ui:baseline:check` from `apps/shield-ui`
- Compose packaging: `docker compose -f infra/docker-compose.production.yml config`

### Expected Service Signals

- API should return `status: ok` from `/health`.
- Evidence Vault should log startup completion, DB validation, Kafka connection, topic subscriptions, and service readiness.
- Sentinel should log startup completion, schedule activation, and scrape-session audit records.
- NLP should log startup completion and readiness for `regulatory_circulars`.
- CV Watchman should log DB validation, VMS connection, initial scan completion, and monitoring activation.

## Shutdown

- Use normal process signals so shared shutdown handlers can flush logs and close connections.
- Avoid forced termination unless the process is already wedged.

## Deployment Notes

- API and Shield UI are horizontally scalable in Phase 1 packaging.
- Worker services are singleton by default in Phase 1 packaging.
- Do not change UI files to adjust deployment endpoints; use runtime config injection instead.

