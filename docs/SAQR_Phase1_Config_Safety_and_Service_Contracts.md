# SAQR Phase 1 Config Safety and Service Contracts

Date: 2026-04-07
Scope: `P1-302` and `P1-304`

## Objective

Harden SAQR startup behavior so production-ready runtime fails fast on unsafe configuration, and publish formal contracts the delivery team can implement against without changing the current UI/UX.

## Completed Outputs

| Task ID | Status | Result |
|---|---|---|
| P1-302 | Completed | Structured config validation and startup safety checks now cover API, Sentinel, CV Watchman, Evidence Vault, and NLP Interpreter. |
| P1-304 | Completed | Formal OpenAPI contract and service-interface handoff documents were added for the delivery team. |

## Startup Safety Expansion

### Shared validation layer

New shared helper:

- `shared/service-config.js`

This adds:

- placeholder-value detection for production-ready runtime
- typed integer and enum validation
- cron-expression validation
- required-list validation
- DB config normalization with production-ready secret checks
- startup warnings for local-address bindings in production-ready runtime

### Runtime-safe service config modules

New per-service config builders:

- `apps/api/src/platform-config.js` enhanced with structured validation and warnings
- `services/sentinel-scrapers/src/config.js`
- `services/cv-watchman/src/config.js`
- `services/evidence-vault/src/config.js`
- `services/nlp-interpreter/src/config.js`

### Hardening behavior now enforced

- API production-ready runtime now validates DB settings and rejects placeholder `JWT_SECRET`.
- Sentinel production-ready runtime rejects demo mode, validates cron, and can fail startup if bridge DB is unavailable.
- CV Watchman production-ready runtime rejects demo VMS, validates scan interval and VMS settings, and can fail startup if DB is unavailable.
- Evidence Vault production-ready runtime validates Kafka bootstrap servers, DB config, and NTP startup behavior.
- NLP Interpreter production-ready runtime rejects `demo-ingest` boot mode and no longer auto-runs demo ingestion in that runtime.

## Contract Pack

Artifacts created:

- `docs/contracts/saqr-api.openapi.yaml`
- `docs/contracts/saqr-service-contracts.md`

### API contract

The OpenAPI contract covers:

- health and runtime endpoints
- auth context endpoint
- dashboard and violation endpoints
- evidence, CDC, NLP, CV, and source-ingestion endpoints
- bearer-auth expectations
- core response schemas for delivery-team integration

### Service contract pack

The service contract document covers:

- Debezium CDC connector contract
- Evidence Vault consumer and persistence contract
- Sentinel scraper staging contract
- NLP ingestion and drift contract
- CV Watchman frame/detection/evidence contract
- delivery-team implementation responsibilities and boundaries

## Environment Profiles Updated

Updated examples:

- `.env.demo.example`
- `.env.production.example`

New documented variables include:

- `KAFKA_BOOTSTRAP_SERVERS`
- `KAFKA_CLIENT_ID`
- `KAFKA_GROUP_ID`
- `EVIDENCE_VAULT_TOPICS`
- `EVIDENCE_VAULT_ALLOW_SYSTEM_CLOCK_FALLBACK`
- `EVIDENCE_VAULT_VALIDATE_NTP_ON_STARTUP`
- `SENTINEL_VALIDATE_DB_ON_STARTUP`
- `SENTINEL_BROWSER_HEADLESS`
- `CV_VALIDATE_DB_ON_STARTUP`
- `CV_VMS_HOST`
- `CV_VMS_PORT`
- `CV_VMS_USERNAME`
- `CV_VMS_PASSWORD`
- `CV_VMS_USE_TLS`
- `CV_VMS_APP_ID`
- `CV_VMS_MAX_FPS`
- `NLP_BOOT_MODE`
- `NLP_VALIDATE_DB_ON_STARTUP`

## Verification Completed

### Syntax validation

- `node --check apps/api/src/platform-config.js`
- `node --check services/sentinel-scrapers/src/index.js`
- `node --check services/cv-watchman/src/index.js`
- `node --check services/evidence-vault/src/index.js`
- `node --check services/nlp-interpreter/src/index.js`

### Test results

- `apps/api`: 9/9 passed
- `services/sentinel-scrapers`: 16/16 passed
- `services/cv-watchman`: 22/22 passed
- `services/evidence-vault`: 20/20 passed
- `services/nlp-interpreter`: 31/34 passed

### Known residual test gap

No residual package test gap remains from this phase. The earlier NLP semantic-parser failures were later resolved under `P1-402`.

## Delivery-Team Notes

- `services/cdc-connector` is a connector artifact set, not a Node.js runtime service.
- The production-ready environment now rejects placeholder secrets and demo boot paths by design.
- The repo still does not include live infrastructure; these contracts are interface-ready for delivery implementation, not infrastructure-complete.
