# SAQR Phase 2 Workflow Foundations

Date: 2026-04-07
Scope: `P2-101` and `P2-102`

## Purpose

This document starts Phase 2 with backend-first workflow foundations. It defines the authoritative workflow domain model and the normalized inbound event contract that later workflow execution, approvals, SLAs, and escalations will build on.

This phase increment does not authorize UI redesign. It preserves the same operating constraints agreed in Phase 1.

## Guardrails Preserved

- The current demo environment remains intact.
- The production-ready Phase 1 track remains the stable baseline.
- UI/UX remains frozen unless a specific change is jointly approved.
- No live database or third-party prerequisites are assumed inside this repository.
- All outputs remain interface-ready for the delivery team.
- Only free or open-source-compatible tools are used.

## What This Increment Completes

- `P2-101`: workflow domain model for workflow definitions, versions, triggers, steps, actions, approvals, SLAs, escalations, evidence links, and audit history.
- `P2-102`: normalized inbound event contract for CDC, NLP, CV, Sentinel, and manual launch paths.

Authoritative artifacts created in this increment:

- `docs/contracts/saqr-workflow-domain.yaml`
- `docs/contracts/saqr-workflow-events.yaml`

## Important Scope Boundary

The current UI-side remediation logic in `apps/shield-ui/WorkflowManager.js` and `apps/shield-ui/Dispatcher.js` remains a Phase 1 demo and operator-assist artifact. It is not the authoritative Phase 2 backend workflow contract.

Phase 2 workflow implementation must therefore treat the new YAML contracts as the source of truth and only expose UI changes later if explicitly approved.

## Workflow Domain Summary

### Core Domain Objects

| Object | Purpose | Notes |
|---|---|---|
| `workflowDefinition` | Stable business definition for a workflow family | Versioned by `workflowKey + version` |
| `workflowVersion` | Published or draft revision metadata | Supports publish, deprecate, retire, rollback |
| `workflowTrigger` | Event routing rule that decides when a workflow starts | Consumes the normalized inbound event contract |
| `workflowStep` | Unit of execution inside a workflow | Supports approval, assignment, remediation, verification, notification, timers, and task creation |
| `approvalPolicy` | Required decision pattern for approval steps | Supports single approver, maker-checker, delegated, and committee patterns |
| `slaPolicy` | Time targets, warning thresholds, and breach behavior | Independent from visual UI timers |
| `escalationPolicy` | Routing and urgency actions after breaches or explicit conditions | Can target user, role, queue, or webhook |
| `evidenceLink` | Reference from a workflow instance to evidence and upstream records | Aligns with Phase 1 `vault` and `shadow` records |
| `workflowInstance` | Runtime execution of a workflow definition | Starts from a normalized inbound event |
| `workflowStepInstance` | Runtime execution of a single step | Carries assignee, approval, deadline, and completion state |
| `workflowAuditEntry` | Immutable history entry for workflow actions and decisions | Required for delivery-team auditability |
| `actorRef` | Canonical actor shape for people, roles, services, or external systems | Keeps approval and audit records consistent |

### Workflow Lifecycle

Definition lifecycle:

- `draft`
- `published`
- `deprecated`
- `retired`

Instance lifecycle:

- `queued`
- `active`
- `waiting_approval`
- `waiting_external`
- `breached`
- `completed`
- `canceled`
- `rolled_back`

Key rule:

- Workflow definitions are versioned and controlled separately from runtime instances. A running instance is pinned to the published version it started with.

### Step Types and Action Model

Supported step categories in the contract:

- `assign`
- `approve`
- `remediate`
- `verify`
- `notify`
- `wait_timer`
- `invoke_webhook`
- `create_task`
- `collect_evidence`

Each step resolves through an explicit `actionType`, not through UI code paths. This keeps execution deterministic and testable before any Phase 2 UI exposure exists.

### Approval, SLA, and Escalation Model

Approval model includes:

- single approver
- maker-checker
- delegated approval
- parallel committee approval

SLA model includes:

- target duration
- warning threshold
- breach threshold
- reminder cadence
- pause and resume rules for waiting-external states

Escalation model includes:

- target type
- trigger condition
- severity override
- notification action
- next-step routing override when needed

### Evidence and Audit Linkage

Workflow instances are designed to link directly to existing Phase 1 evidence and shadow-plane records. The first contract release explicitly supports references to:

- `vault.evidence`
- `shadow.cdc_events`
- `shadow.obligations`
- `shadow.instruction_drift`
- `shadow.cv_detections`
- `shadow.regulatory_staging`

This means workflow actions will be traceable back to the exact alert, detection, drift record, or staged regulatory change that triggered them.

### Entity Scope Linkage

The workflow model carries the canonical Phase 2 scope fields that are now defined formally by the multi-entity hierarchy contract in `docs/contracts/saqr-entity-hierarchy.yaml`. The workflow foundations therefore include optional scope slots for:

- `groupId`
- `entityId`
- `businessUnitId`
- `siteId`
- `siloId`

These fields remain optional in the workflow event and workflow-definition contracts, but they are no longer undefined placeholders. `P2-201` now defines their hierarchy meaning and lineage behavior.

## Inbound Event Contract Summary

### Normalized Event Envelope

All workflow-triggering events must first be normalized into one common envelope before any workflow matching or runtime execution begins.

| Field | Required | Purpose |
|---|---|---|
| `eventId` | Yes | Stable event identifier from the producing source or normalization layer |
| `idempotencyKey` | Yes | Deduplication key for repeat deliveries |
| `eventType` | Yes | Specific event name such as `cdc.violation.detected` |
| `sourceFamily` | Yes | One of `cdc`, `nlp`, `cv`, `sentinel`, `manual` |
| `occurredAt` | Yes | Source occurrence time |
| `ingestedAt` | Yes | Workflow-ingestion normalization time |
| `severity` | Yes | Normalized severity used for routing and SLA policy |
| `authority` | Conditional | Regulatory authority when applicable |
| `entityScope` | Yes | Future-safe scope envelope even when only partially populated |
| `correlation` | Yes | Keys used to tie the event to evidence, document revision, table row, camera, or source URL |
| `evidenceRefs` | No | One or more evidence or upstream record references |
| `actor` | Conditional | Required when the event is manual |
| `payload` | Yes | Source-family-specific business payload |

### Supported Event Families

| Event Type | Source Family | Typical Origin |
|---|---|---|
| `cdc.violation.detected` | `cdc` | Evidence Vault CDC compliance flow |
| `nlp.drift.detected` | `nlp` | NLP drift detection flow |
| `nlp.obligation.triggered` | `nlp` | NLP constraint or obligation evaluation |
| `cv.violation.detected` | `cv` | CV Watchman evidence flow |
| `sentinel.regulatory_update.detected` | `sentinel` | Sentinel staging and update detection |
| `workflow.manual.triggered` | `manual` | Analyst or auditor initiated workflow launch |

### Source-Specific Contract Notes

- CDC events are expected to carry source-table identity, operation type, relevant record state, and violation summary.
- NLP events are expected to carry document identity, obligation or drift identity, and structured parameter deltas when available.
- CV events are expected to carry camera identity, detection identity, violation classification, confidence, and evidence references.
- Sentinel events are expected to carry authority, staged content identity, source URL, and update classification.
- Manual events must carry an initiating actor, a launch reason, and either a direct evidence reference or an explicit external business reference.

### Routing and Normalization Rules

- Source producers are not expected to publish identical payloads.
- Delivery routing must normalize each source into the common envelope before workflow matching.
- Workflow triggers match against normalized attributes such as `eventType`, `severity`, `authority`, `entityScope`, and correlation fields.
- Re-delivered events must not start duplicate workflow instances when the `idempotencyKey` has already been processed for the same workflow trigger.

## Current Repo Truth Captured by These Contracts

- The demo environment remains preserved and separate.
- UI/UX remains frozen and unchanged in this increment.
- Sentinel live implementation scope is currently centered on `SAMA` and `SDAIA`.
- NLP and CV are interface-ready and test-backed, but delivery still owns real-environment wiring and pilot validation.
- Phase 2 workflow foundations are backend-first and do not yet expose an approved admin UI.
- The canonical entity hierarchy is now defined separately in `docs/contracts/saqr-entity-hierarchy.yaml` and should be treated as the source of truth for future scope lineage.

## Next Recommended Step

The next logical task is `P2-103`: define the workflow DSL and validation rules that sit on top of these two contracts.

## References

- Main tracker: `docs/SAQR_Phase_1_Phase_2_Tracker.md`
- Phase 2 roadmap: `docs/SAQR_Phase2_Roadmap.md`
- Phase 2 checklist: `docs/checklists/SAQR_Phase2_Execution_Checklist.md`
- Multi-entity domain model: `docs/SAQR_Phase2_Multi_Entity_Domain_Model.md`
- Existing service contracts: `docs/contracts/saqr-service-contracts.md`
- Existing execution sequences: `docs/contracts/saqr-execution-sequences.yaml`
- Existing data dictionary: `docs/contracts/saqr-data-dictionary.md`
