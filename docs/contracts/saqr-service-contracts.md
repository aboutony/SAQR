# SAQR Service Contracts

Date: 2026-04-07
Scope: Phase 1 delivery handoff

## Purpose

This document defines the non-UI service contracts the delivery team must implement or preserve when moving SAQR from the current repository state into a real target environment.

Related execution-sequence artifact:

- `docs/contracts/saqr-execution-sequences.yaml`

Related data-contract artifacts:

- `docs/contracts/saqr-data-dictionary.md`
- `docs/contracts/saqr-schema-versioning.yaml`

Related integration-adapter artifact:

- `docs/contracts/saqr-integration-adapters.md`

Related Phase 2 workflow-foundation artifacts:

- `docs/contracts/saqr-workflow-domain.yaml`
- `docs/contracts/saqr-workflow-events.yaml`
- `docs/contracts/saqr-workflow-dsl.yaml`

Related Phase 2 workflow-runtime artifact:

- `docs/SAQR_Phase2_Workflow_Execution_Engine.md`
- `docs/SAQR_Phase2_Approval_Routing_Engine.md`
- `docs/SAQR_Phase2_SLA_Automation.md`
- `docs/SAQR_Phase2_Workflow_Governance.md`
- `docs/SAQR_Phase2_Workflow_Audit_Model.md`
- `docs/SAQR_Phase2_UI_Safe_Integration_Plan.md`
- `docs/SAQR_Phase2_Workflow_Contract_Package.md`
- `docs/contracts/saqr-workflow-api.openapi.yaml`
- `docs/contracts/saqr-workflow-fixtures.yaml`
- `docs/contracts/saqr-workflow-ui-integration.yaml`

Related acceptance-fixture artifact:

- `docs/contracts/saqr-acceptance-fixtures.yaml`

Related deployment-blueprint artifact:

- `docs/contracts/saqr-deployment-blueprint.yaml`

Related delivery-pipeline artifact:

- `docs/contracts/saqr-delivery-pipeline.yaml`

Related architecture and runbook entrypoint:

- `docs/README.md`

Related final handoff-package entrypoint:

- `docs/handoff/README.md`

## Runtime Contract

All runtime services follow the same runtime switch:

| Variable | Allowed Values | Effect |
|---|---|---|
| `SAQR_RUNTIME_MODE` | `demo`, `production`, `production-ready`, `prod`, `handoff` | Controls demo-vs-production-ready behavior and fail-fast validation. |

Production-ready runtime guarantees:

- placeholder secrets and placeholder connection values are rejected at startup
- demo-only execution modes are rejected
- startup warnings are emitted for local-address bindings

## Connector Contract

Artifact location:

- `services/cdc-connector/connector-config.json`
- `services/cdc-connector/register-connector.sh`

Important note:

- `services/cdc-connector` is not a Node.js service. It is a Debezium connector artifact set for Kafka Connect.

Shared DB adapter used across runtime services:

- `shared/postgres-adapter.js`

### Source database contract

| Field | Contract |
|---|---|
| Connector class | `io.debezium.connector.postgresql.PostgresConnector` |
| Transport | PostgreSQL logical replication via WAL |
| Write behavior | Read-only only. No writes back to source systems are allowed. |
| Source tables | `public.consumer_disclosures`, `public.fee_schedule`, `public.cooling_off_periods`, `public.branch_compliance` |

### Kafka topic contract

Topic prefix:

- `saqr.cdc`

Expected topics:

- `saqr.cdc.client_banking.public.consumer_disclosures`
- `saqr.cdc.client_banking.public.fee_schedule`
- `saqr.cdc.client_banking.public.cooling_off_periods`
- `saqr.cdc.client_banking.public.branch_compliance`

### CDC payload contract

Minimal event shape consumed by SAQR services:

```json
{
  "payload": {
    "op": "u",
    "before": { "font_size_pt": 12 },
    "after": { "font_size_pt": 11 },
    "source": {
      "db": "client_banking",
      "table": "consumer_disclosures"
    }
  }
}
```

Required fields for SAQR processing:

- `payload.op`
- `payload.source.table`
- at least one of `payload.before` or `payload.after`

## Evidence Vault Contract

Runtime entry:

- `services/evidence-vault/src/index.js`

Structured config:

- `services/evidence-vault/src/config.js`

### Inputs

- Kafka CDC events from the topics listed above
- NTP authority from `NTP_SERVER`
- PostgreSQL shadow database connection

### Outputs

| Target | Purpose |
|---|---|
| `shadow.cdc_events` | Immutable ingest history of source-system CDC events |
| `vault.evidence` | Sealed evidence records for detected violations |
| `vault.merkle_log` | Daily Merkle seal batches for evidence integrity |

### Evidence record contract

```json
{
  "evidence_type": "cdc_violation",
  "source_module": "compliance-engine",
  "violation_code": "SAMA-CP-001",
  "authority": "SAMA",
  "severity": "high",
  "title": "Disclosure Font Size Below 14pt",
  "description": "Digital disclosure rendered at 11pt",
  "raw_payload": {},
  "sha256_hash": "hex-sha256",
  "ntp_timestamp": "2026-04-07T09:15:00.000Z"
}
```

### Startup contract

Production-ready runtime requires:

- `KAFKA_BOOTSTRAP_SERVERS`
- non-placeholder shadow DB connection values
- NTP validation unless `EVIDENCE_VAULT_VALIDATE_NTP_ON_STARTUP=false`

### Provider-agnostic runtime boundary

Phase 1 now enforces the CDC/evidence execution path behind explicit provider contracts in:

- `services/evidence-vault/src/cdc-flow.js`
- `shared/provider-contract.js`

Required provider methods:

- `messageDecoder.decode(message)`
- `timestampAuthority.getTimestamp()`
- `complianceEvaluator.detect(table, operation, record)`
- `repository.storeCdcEvent(event, timestampAuthorityRecord, hash)`
- `repository.storeViolationEvidence(violation, timestampAuthorityRecord)`
- `repository.loadEvidenceHashesForDate(batchDate)`
- `repository.storeMerkleBatch(batch)`

Default adapters now supplied in code:

- Debezium envelope decoder
- NTP timestamp authority
- rule-based compliance evaluator
- PostgreSQL evidence repository

Modular rule-engine artifacts:

- `shared/rule-engine.js`
- `services/evidence-vault/src/compliance-engine.js`
- `services/evidence-vault/src/rules/sama-disclosure-rules.js`
- `services/evidence-vault/src/rules/sama-cooling-off-rules.js`
- `services/evidence-vault/src/rules/momah-branch-rules.js`

## Sentinel Scraper Contract

Runtime entry:

- `services/sentinel-scrapers/src/index.js`

Adapter boundary:

- `services/sentinel-scrapers/src/source-adapters.js`
- `services/sentinel-scrapers/src/bridge.js`

Structured config:

- `services/sentinel-scrapers/src/config.js`

### Supported modes

| Variable | Allowed Values | Production-ready rule |
|---|---|---|
| `SENTINEL_MODE` | `demo`, `live` | `demo` is rejected |

### Authorities

Current live implementation scope:

- `SAMA`
- `SDAIA`

### Output staging contract

Sentinel writes or simulates records shaped like:

```json
{
  "authority": "SAMA",
  "title": "Circular: Maximum Limit for Admin Fees on SME Products",
  "sourceUrl": "https://sama.gov.sa/en-US/Circulars/Pages/BankCirculars.aspx",
  "contentHash": "hex-sha256",
  "detectedAt": "2026-04-07T09:20:00.000Z"
}
```

Persistence target:

- `shadow.regulatory_staging`

Heartbeat exposure:

- `/api/v1/sources/heartbeat`
- `/api/v1/sources/staging/recent`

Adapter contract summary:

- Regulatory source providers must implement `fetchEntries({ mode, browser, logger })`.
- Staging repositories must implement `upsertRule(rule)`.
- New authorities should be registered in the source registry rather than hard-coded into the scheduler.

## NLP Interpreter Contract

Runtime entry:

- `services/nlp-interpreter/src/index.js`

Structured config:

- `services/nlp-interpreter/src/config.js`

### Supported boot modes

| Variable | Allowed Values | Production-ready rule |
|---|---|---|
| `NLP_BOOT_MODE` | `demo-ingest`, `service` | `demo-ingest` is rejected |

### Ingestion function contract

Primary callable contract:

- `ingestCircular(rawText, metadata)`

Input shape:

```json
{
  "rawText": "Regulatory circular text",
  "metadata": {
    "authority": "SAMA",
    "title": "Consumer Protection Circular 2026",
    "referenceNumber": "SAMA-CP-2026-001",
    "issueDate": "2026-01-15"
  }
}
```

Output shape:

```json
{
  "parsed": {
    "documentId": "DOC-...",
    "authority": "SAMA",
    "language": "ar",
    "sections": []
  },
  "obligations": [],
  "drifts": []
}
```

Persistence targets:

- `shadow.obligations`
- `shadow.instruction_drift`

### Provider-agnostic runtime boundary

Phase 1 now enforces the NLP ingestion path behind explicit provider contracts in:

- `services/nlp-interpreter/src/nlp-flow.js`
- `shared/provider-contract.js`

Required provider methods:

- `parser.parse(rawText, metadata)`
- `obligationExtractor.extract(sections, authority)`
- `driftDetector.detect(baseline, obligations, authority)`
- `repository.loadBaseline(authority)`
- `repository.storeObligation(obligation, documentId)`
- `repository.storeDriftAlert(alert)`

Default adapters now supplied in code:

- rule-based parser adapter
- rule-based obligation extractor adapter
- rule-based drift detector adapter
- PostgreSQL baseline and persistence repository

Modular rule-evaluation artifacts:

- `shared/rule-engine.js`
- `services/nlp-interpreter/src/constraint-engine.js`
- `services/nlp-interpreter/src/rules/constraint-rules.js`

## CV Watchman Contract

Runtime entry:

- `services/cv-watchman/src/index.js`

Adapter boundary:

- `services/cv-watchman/src/vms/vms-adapter.js`

Structured config:

- `services/cv-watchman/src/config.js`

### Supported VMS types

| Variable | Allowed Values | Production-ready rule |
|---|---|---|
| `VMS_TYPE` | `demo`, `milestone`, `genetec` | `demo` is rejected |

### VMS connection contract

Required for non-demo production-ready runtime:

- `CV_VMS_HOST`
- `CV_VMS_PORT`
- `CV_VMS_USERNAME`
- `CV_VMS_PASSWORD`

Optional:

- `CV_VMS_USE_TLS`
- `CV_VMS_APP_ID`
- `CV_VMS_MAX_FPS`

### Frame input contract

```json
{
  "buffer": "binary frame bytes",
  "timestamp": "2026-04-07T09:25:00.000Z",
  "cameraId": "CAM-BRANCH-01",
  "source": "milestone",
  "width": 1920,
  "height": 1080
}
```

### Detection output contract

```json
{
  "cameraId": "CAM-BRANCH-01",
  "violationCode": "MOMAH-CV-001",
  "category": "signage",
  "confidence": 0.94,
  "bbox": { "x": 10, "y": 20, "width": 200, "height": 140 },
  "severity": "critical",
  "nameEn": "Damaged Signage",
  "nameAr": "لوحة متضررة"
}
```

Persistence targets:

- `shadow.cv_detections`
- `vault.evidence`

### Provider-agnostic runtime boundary

Phase 1 now enforces the CV scan path behind explicit provider contracts in:

- `services/cv-watchman/src/cv-flow.js`
- `shared/provider-contract.js`

Required provider methods:

- `frameSource.grabAllFrames()`
- `detectionEngine.detect(frame)`
- `evidenceFactory.create(detection, frame)`
- `evidenceRepository.record(evidence)`
- `maintenanceNotifier.notify(evidence)`

Default adapters now supplied in code:

- VMS-backed frame source via `VmsAdapter`
- rule-based detection engine
- evidence-record factory
- maintenance-alert notifier
- PostgreSQL evidence repository

VMS provider contract summary:

- Provider methods required: `authenticate()`, `getCameras()`, `grabFrame(cameraId)`, `getStatus()`
- Built-in provider types: `milestone`, `genetec`, `demo`
- Delivery teams may inject a custom provider registry without changing the CV scan flow

## API/Auth Contract

Formal API spec:

- `docs/contracts/saqr-api.openapi.yaml`

JWT requirements for production-ready runtime:

- algorithm: `HS256`
- issuer: `AUTH_JWT_ISSUER`
- audience: `AUTH_JWT_AUDIENCE`
- secret: `JWT_SECRET`

UI integration rule:

- the delivery team should place the bearer token in `sessionStorage['saqr_api_bearer_token']`
- no visual or UX changes are required for this contract

## Delivery-Team Responsibilities

- provision the real DB, Kafka, VMS, and regulatory-source environments
- replace all placeholder secrets and connection values
- wire identity and token issuance to the Phase 1 JWT contract
- preserve the demo environment and keep it separate from the production-ready environment
- implement against these contracts without changing the current UI unless separately approved
