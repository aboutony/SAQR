# SAQR Phase 1 Provider-Agnostic Flows

Date: 2026-04-07
Scope: `P1-401`

## Objective

Convert the production-ready NLP, CV, and CDC execution paths into explicit provider-agnostic interfaces so the delivery team can replace infrastructure dependencies without rewriting the core algorithms.

## Completed Result

`P1-401` is now complete.

## What Was Added

Shared contract enforcement:

- `shared/provider-contract.js`

Flow modules:

- `services/nlp-interpreter/src/nlp-flow.js`
- `services/cv-watchman/src/cv-flow.js`
- `services/evidence-vault/src/cdc-flow.js`

New contract tests:

- `services/nlp-interpreter/src/nlp-flow.test.js`
- `services/cv-watchman/src/cv-flow.test.js`
- `services/evidence-vault/src/cdc-flow.test.js`

## Algorithm Boundaries

### NLP Interpreter

Core algorithm is now separated from infrastructure concerns:

- parsing
- obligation extraction
- drift detection
- baseline/persistence repository

Required provider methods:

- `parser.parse(rawText, metadata)`
- `obligationExtractor.extract(sections, authority)`
- `driftDetector.detect(baseline, obligations, authority)`
- `repository.loadBaseline(authority)`
- `repository.storeObligation(obligation, documentId)`
- `repository.storeDriftAlert(alert)`

Default adapters preserve current behavior:

- rule-based parser/extractor/drift modules
- PostgreSQL-backed baseline and persistence repository

### CV Watchman

Core scan algorithm is now separated from external capture and persistence concerns:

- frame acquisition
- detection engine
- evidence creation
- maintenance notification
- evidence persistence

Required provider methods:

- `frameSource.grabAllFrames()`
- `detectionEngine.detect(frame)`
- `evidenceFactory.create(detection, frame)`
- `evidenceRepository.record(evidence)`
- `maintenanceNotifier.notify(evidence)`

Default adapters preserve current behavior:

- `VmsAdapter` frame source
- current rule-based detector plus NMS
- current evidence bridge
- PostgreSQL persistence into `shadow.cv_detections` and `vault.evidence`

### Evidence Vault / CDC

Core CDC processing is now separated from transport, timing authority, and persistence concerns:

- message decoding
- timestamp authority
- compliance evaluation
- evidence repository
- Merkle batch sealing

Required provider methods:

- `messageDecoder.decode(message)`
- `timestampAuthority.getTimestamp()`
- `complianceEvaluator.detect(table, operation, record)`
- `repository.storeCdcEvent(event, timestampAuthorityRecord, hash)`
- `repository.storeViolationEvidence(violation, timestampAuthorityRecord)`
- `repository.loadEvidenceHashesForDate(batchDate)`
- `repository.storeMerkleBatch(batch)`

Default adapters preserve current behavior:

- Debezium envelope decoder
- NTP timestamp authority
- current rule-based compliance engine
- PostgreSQL evidence repository

## Delivery Impact

This phase gives the delivery team clear swap points for:

- real document feeds or parser providers in NLP
- real VMS and vision providers in CV
- real CDC transport and persistence providers in Evidence Vault

The key outcome is that the orchestration logic is no longer hard-wired to the current demo-friendly infrastructure assumptions.

## Verification

Syntax checks passed for:

- `shared/provider-contract.js`
- `services/nlp-interpreter/src/nlp-flow.js`
- `services/nlp-interpreter/src/index.js`
- `services/cv-watchman/src/cv-flow.js`
- `services/cv-watchman/src/index.js`
- `services/evidence-vault/src/cdc-flow.js`
- `services/evidence-vault/src/index.js`

Package test results:

- `services/nlp-interpreter`: `37/37` passed
- `services/cv-watchman`: `24/24` passed
- `services/evidence-vault`: `23/23` passed

No UI or UX files were changed in this phase.
