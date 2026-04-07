# SAQR Data Dictionary

Date: 2026-04-07
Scope: Phase 1 `P1-501`

## Purpose

This document defines the current schema-level data contracts for the production-ready SAQR package. It is the delivery-team reference for schema ownership, mutation rules, business keys, and the minimum column semantics that current services expect.

## Data Plane Summary

| Schema | Role | Write Owner | Read Consumers | Mutation Policy |
|---|---|---|---|---|
| `public` | Mock source-system schema replicated by Debezium | Client source systems only | Debezium / CDC connector | Source-owned. SAQR never writes back. |
| `shadow` | Operational shadow state for CDC, NLP, CV, and staging | SAQR runtime services | API, Evidence Vault, NLP, CV, delivery orchestration | Additive evolution only in Phase 1. |
| `vault` | Immutable evidence and integrity records | Evidence Vault and CV evidence flow | API, audit/export consumers | `vault.evidence` and `vault.merkle_log` are immutable. |
| `platform` | Migration governance and schema ledger | Delivery migration operator | Delivery tooling, governance review | Append-only migration history. |

## Source Schema: `public`

### `public.consumer_disclosures`

| Field | Type | Contract |
|---|---|---|
| `id` | `SERIAL` | Primary key. |
| `product_id` | `VARCHAR(50)` | Source product identifier. |
| `product_name` | `VARCHAR(200)` | Human-readable product name. |
| `disclosure_text` | `TEXT` | Regulatory disclosure content under CDC monitoring. |
| `font_size_pt` | `INTEGER` | Numeric font-size value used by the CDC compliance rules. |
| `language` | `VARCHAR(5)` | Source language code. |
| `channel` | `VARCHAR(50)` | Delivery channel such as `branch` or `digital`. |
| `is_active` | `BOOLEAN` | Active-state flag for current disclosure. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Source create timestamp. |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | Source update timestamp. |

Contract notes:

- Write owner: client source system.
- Replication rule: `REPLICA IDENTITY FULL`.
- Current SAQR usage: fee/disclosure CDC comparison and evidence generation.

### `public.fee_schedule`

| Field | Type | Contract |
|---|---|---|
| `id` | `SERIAL` | Primary key. |
| `product_id` | `VARCHAR(50)` | Source product identifier. |
| `fee_type` | `VARCHAR(100)` | Fee classification consumed by CDC rules. |
| `fee_amount_sar` | `DECIMAL(10,2)` | SAR-denominated fee amount. |
| `effective_date` | `DATE` | Fee effective date. |
| `expiry_date` | `DATE` | Optional fee end date. |
| `approved_by` | `VARCHAR(200)` | Human approval metadata when present. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Source create timestamp. |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | Source update timestamp. |

Contract notes:

- Write owner: client source system.
- Replication rule: `REPLICA IDENTITY FULL`.
- Current SAQR usage: fee-cap CDC compliance detection.

### `public.cooling_off_periods`

| Field | Type | Contract |
|---|---|---|
| `id` | `SERIAL` | Primary key. |
| `contract_id` | `VARCHAR(50)` | Customer contract identifier. |
| `customer_id` | `VARCHAR(50)` | Customer identifier. |
| `product_type` | `VARCHAR(100)` | Product classification. |
| `start_date` | `TIMESTAMP WITH TIME ZONE` | Cooling-off period start. |
| `end_date` | `TIMESTAMP WITH TIME ZONE` | Cooling-off period end. |
| `status` | `VARCHAR(20)` | Source lifecycle state. |
| `cancellation_requested` | `BOOLEAN` | Source cancellation flag. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Source create timestamp. |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | Source update timestamp. |

Contract notes:

- Write owner: client source system.
- Replication rule: `REPLICA IDENTITY FULL`.
- Current SAQR usage: cooling-off violation detection in CDC rules.

### `public.branch_compliance`

| Field | Type | Contract |
|---|---|---|
| `id` | `SERIAL` | Primary key. |
| `branch_code` | `VARCHAR(20)` | Branch identifier. |
| `branch_name` | `VARCHAR(200)` | Human-readable branch name. |
| `municipality` | `VARCHAR(100)` | Municipality or city authority context. |
| `signage_status` | `VARCHAR(50)` | Municipal signage compliance state. |
| `lighting_status` | `VARCHAR(50)` | Lighting compliance state. |
| `partition_status` | `VARCHAR(50)` | Partitioning compliance state. |
| `last_audit_date` | `DATE` | Most recent branch audit date. |
| `license_expiry` | `DATE` | Branch commercial license expiry date. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Source create timestamp. |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | Source update timestamp. |

Contract notes:

- Write owner: client source system.
- Replication rule: `REPLICA IDENTITY FULL`.
- Current SAQR usage: MOMAH-oriented CDC rule checks.

## Operational Shadow Schema: `shadow`

### `shadow.cdc_events`

| Field | Type | Contract |
|---|---|---|
| `id` | `BIGSERIAL` | Primary key. |
| `source_system` | `VARCHAR(100)` | Source database or subsystem identifier. |
| `source_table` | `VARCHAR(200)` | Source table name from the CDC envelope. |
| `operation` | `VARCHAR(10)` | Allowed values: `INSERT`, `UPDATE`, `DELETE`. |
| `before_state` | `JSONB` | Pre-change state when available. |
| `after_state` | `JSONB` | Post-change state when available. |
| `event_timestamp` | `TIMESTAMP WITH TIME ZONE` | Source event timestamp. |
| `ingested_at` | `TIMESTAMP WITH TIME ZONE` | Shadow ingest timestamp. |
| `sha256_hash` | `CHAR(64)` | Canonical CDC-event hash. |

Contract notes:

- Write owner: Evidence Vault CDC flow.
- Read consumers: Evidence Vault, audit review, downstream replay tooling.
- Mutation policy: append-only by contract.

### `shadow.obligations`

| Field | Type | Contract |
|---|---|---|
| `id` | `BIGSERIAL` | Primary key. |
| `obligation_id` | `VARCHAR(50)` | Business key generated by the NLP flow. |
| `document_id` | `VARCHAR(100)` | Parsed document identifier. |
| `authority` | `VARCHAR(20)` | Regulatory authority. |
| `article` | `VARCHAR(50)` | Source article or clause reference when present. |
| `obligation_text` | `TEXT` | Extracted obligation text. |
| `obligation_type` | `VARCHAR(30)` | Allowed values: `prohibition`, `requirement`, `threshold`, `deadline`. |
| `parameters` | `JSONB` | Normalized extracted parameters and thresholds. |
| `severity` | `VARCHAR(20)` | NLP-derived severity label. |
| `confidence` | `DECIMAL(3,2)` | Extractor confidence score. |
| `source_section` | `VARCHAR(50)` | Parsed section reference. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Insert timestamp. |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | Update timestamp. |

Contract notes:

- Write owner: NLP ingestion flow.
- Read consumers: API, drift detector baseline loader, future alerting/wiring layers.
- Mutation policy: additive and update-safe. Delivery team must preserve `obligation_id` stability across reprocessing.

### `shadow.instruction_drift`

| Field | Type | Contract |
|---|---|---|
| `id` | `BIGSERIAL` | Primary key. |
| `alert_id` | `VARCHAR(50)` | Business key for the drift alert. |
| `drift_type` | `VARCHAR(30)` | Allowed values: `added`, `removed`, `modified`, `parameter_change`. |
| `authority` | `VARCHAR(20)` | Regulatory authority. |
| `severity` | `VARCHAR(20)` | Drift severity label. |
| `title` | `VARCHAR(500)` | Short drift title shown by API/UI. |
| `description` | `TEXT` | Human-readable drift description. |
| `previous_obligation` | `JSONB` | Previous obligation snapshot when present. |
| `new_obligation` | `JSONB` | New obligation snapshot when present. |
| `parameter_diff` | `JSONB` | Structured parameter-level diff. |
| `detected_at` | `TIMESTAMP WITH TIME ZONE` | Drift detection timestamp. |
| `acknowledged` | `BOOLEAN` | Optional delivery-workflow acknowledgement flag. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Insert timestamp. |

Contract notes:

- Write owner: NLP drift detection flow.
- Read consumers: API and future workflow/alert-routing layers.
- Mutation policy: inserts are primary; acknowledgement updates are allowed.

### `shadow.cv_detections`

| Field | Type | Contract |
|---|---|---|
| `id` | `BIGSERIAL` | Primary key. |
| `evidence_id` | `VARCHAR(100)` | Detection business key and dedupe key. |
| `camera_id` | `VARCHAR(100)` | Camera identifier from the VMS/provider. |
| `source` | `VARCHAR(30)` | Frame source type. |
| `violation_code` | `VARCHAR(50)` | Regulatory or operational violation code. |
| `category` | `VARCHAR(30)` | Allowed values: `signage`, `visual`, `structural`. |
| `confidence` | `DECIMAL(4,3)` | Detection confidence. |
| `bbox` | `JSONB` | Bounding box data. |
| `frame_hash` | `CHAR(64)` | Frame payload hash. |
| `detection_hash` | `CHAR(64)` | Detection payload hash. |
| `ntp_timestamp` | `TIMESTAMP WITH TIME ZONE` | Trusted event timestamp. |
| `severity` | `VARCHAR(20)` | Detection severity. |
| `name_en` | `VARCHAR(200)` | English label. |
| `name_ar` | `VARCHAR(200)` | Arabic label. |
| `record_type` | `VARCHAR(20)` | Before/after style capture label, default `before`. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Insert timestamp. |

Contract notes:

- Write owner: CV Watchman evidence flow.
- Read consumers: API and evidence review.
- Mutation policy: append-only by business intent; dedupe keyed on `evidence_id`.

### `shadow.camera_registry`

| Field | Type | Contract |
|---|---|---|
| `id` | `SERIAL` | Primary key. |
| `camera_id` | `VARCHAR(100)` | Stable business key from the VMS. |
| `name` | `VARCHAR(500)` | Human-readable camera label. |
| `vms_type` | `VARCHAR(30)` | Allowed values: `milestone`, `genetec`, `demo`. |
| `site_name` | `VARCHAR(200)` | Site or branch name. |
| `zone` | `VARCHAR(100)` | Optional zone within the site. |
| `enabled` | `BOOLEAN` | Camera active flag. |
| `last_frame_at` | `TIMESTAMP WITH TIME ZONE` | Most recent successful frame capture. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Insert timestamp. |

Contract notes:

- Write owner: delivery VMS onboarding and CV service support tooling.
- Read consumers: CV Watchman, API.
- Mutation policy: normal CRUD allowed outside the frozen demo environment.

### `shadow.regulatory_staging`

| Field | Type | Contract |
|---|---|---|
| `id` | `SERIAL` | Primary key. |
| `authority` | `VARCHAR(20)` | Regulatory authority. |
| `title` | `TEXT` | Staged document title. |
| `source_url` | `TEXT` | Regulatory source URL. |
| `content_hash` | `VARCHAR(64)` | Unique dedupe key for staged content. |
| `publish_date` | `VARCHAR(40)` | Source-side publish date as captured. |
| `category` | `VARCHAR(100)` | Source classification. |
| `detected_at` | `TIMESTAMP WITH TIME ZONE` | Staging detection timestamp. |
| `analyzed` | `BOOLEAN` | Delivery orchestration status flag for downstream NLP ingestion. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Insert timestamp. |

Contract notes:

- Write owner: Sentinel Scrapers / Sovereign Bridge.
- Read consumers: API heartbeat endpoints and planned document-ingestion worker.
- Mutation policy: insert-first with dedupe on `content_hash`; downstream `analyzed` updates are delivery-owned.

## Immutable Evidence Schema: `vault`

### `vault.evidence`

| Field | Type | Contract |
|---|---|---|
| `id` | `BIGSERIAL` | Primary key. |
| `evidence_type` | `VARCHAR(50)` | Allowed values: `cdc_violation`, `visual_audit`, `nlp_obligation`, `manual_entry`. |
| `source_module` | `VARCHAR(50)` | Producing service or module. |
| `violation_code` | `VARCHAR(50)` | Related violation code when present. |
| `authority` | `VARCHAR(20)` | Allowed values: `SAMA`, `MOMAH`, `SFDA`, `OTHER`. |
| `severity` | `VARCHAR(20)` | Allowed values: `critical`, `high`, `medium`, `low`, `info`. |
| `title` | `VARCHAR(500)` | Human-readable evidence title. |
| `description` | `TEXT` | Evidence description. |
| `raw_payload` | `JSONB` | Canonical evidence payload. |
| `sha256_hash` | `CHAR(64)` | Unique evidence business key and dedupe key. |
| `ntp_timestamp` | `TIMESTAMP WITH TIME ZONE` | Trusted timestamp authority value. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Insert timestamp. |

Contract notes:

- Write owner: Evidence Vault and CV evidence flow.
- Read consumers: API, audit export, integrity review.
- Mutation policy: immutable. Update and delete are trigger-blocked.

### `vault.merkle_log`

| Field | Type | Contract |
|---|---|---|
| `id` | `BIGSERIAL` | Primary key. |
| `batch_date` | `DATE` | Unique daily batch date. |
| `evidence_count` | `INTEGER` | Evidence count included in the batch. |
| `merkle_root` | `CHAR(64)` | Daily Merkle root. |
| `leaf_hashes` | `TEXT[]` | Ordered evidence hashes used to compute the root. |
| `computed_at` | `TIMESTAMP WITH TIME ZONE` | Batch computation timestamp. |

Contract notes:

- Write owner: Evidence Vault batch processor.
- Read consumers: API and integrity-verification tooling.
- Mutation policy: immutable. Update and delete are trigger-blocked.

### `vault.penalty_schedule`

| Field | Type | Contract |
|---|---|---|
| `id` | `SERIAL` | Primary key. |
| `authority` | `VARCHAR(20)` | Allowed values: `SAMA`, `MOMAH`, `SFDA`. |
| `violation_code` | `VARCHAR(50)` | Unique business key. |
| `description_ar` | `TEXT` | Arabic violation description. |
| `description_en` | `TEXT` | English violation description. |
| `min_penalty_sar` | `DECIMAL(12,2)` | Minimum SAR penalty. |
| `max_penalty_sar` | `DECIMAL(12,2)` | Maximum SAR penalty. |
| `effective_date` | `DATE` | Penalty record effective date. |
| `source_document` | `VARCHAR(500)` | Source regulation/circular reference. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Insert timestamp. |

Contract notes:

- Write owner: delivery migration/operator updates.
- Read consumers: API and evidence enrichment.
- Current seeded baseline: 6 rows in the repo baseline.

## Platform Governance Schema: `platform`

### `platform.schema_migrations`

| Field | Type | Contract |
|---|---|---|
| `id` | `BIGSERIAL` | Primary key. |
| `migration_id` | `VARCHAR(120)` | Unique migration identifier. |
| `component` | `VARCHAR(40)` | Allowed values: `source`, `shadow`, `vault`, `platform`, `contract`. |
| `schema_name` | `VARCHAR(60)` | Target schema. |
| `object_name` | `VARCHAR(200)` | Target object or artifact name. |
| `checksum_sha256` | `CHAR(64)` | Migration artifact checksum. |
| `execution_mode` | `VARCHAR(20)` | Allowed values: `manual`, `automated`. |
| `compatibility_level` | `VARCHAR(20)` | Allowed values: `backward`, `breaking`, `forward_fix`. |
| `applied_by` | `VARCHAR(200)` | Operator or runtime actor that applied the migration. |
| `applied_at` | `TIMESTAMP WITH TIME ZONE` | Migration application timestamp. |
| `notes` | `TEXT` | Optional compatibility or rollout note. |

Contract notes:

- Write owner: delivery migration operator only.
- Read consumers: governance review, release checklist, audit preparation.
- Mutation policy: append-only migration history. Corrections should be recorded as new rows, not destructive edits.

## Delivery Notes

- Any schema change that affects these contracts must update both this dictionary and [saqr-schema-versioning.yaml](C:/Users/fahme/.gemini/antigravity/scratch/saqr/docs/contracts/saqr-schema-versioning.yaml).
- Phase 1 keeps the demo environment frozen. Apply migrations only to the production-ready data plane unless there is explicit approval.
- The repo remains intentionally interface-ready. Real database provisioning and operational rollout stay with the delivery team.
