# SAQR Phase 2 Workflow Audit Model

Date: 2026-04-07
Scope: `P2-108`

## Purpose

This document closes `P2-108` by defining the workflow-audit model now implemented for the Phase 2 engine.

This increment remains backend-only. No UI or UX changes were introduced.

## What Was Added

Workflow audit modeling now lives in:

- `services/workflow-engine/src/audit-ledger.js`
- `services/workflow-engine/src/audit-ledger.test.js`
- `services/workflow-engine/src/runtime-core.js`
- `services/workflow-engine/src/index.js`

## Audit Capabilities Now Implemented

### 1. Immutable Ledger Projections

The workflow package can now project two existing histories into one normalized audit-ledger shape:

- runtime workflow audit entries from live workflow instances
- governance history entries from workflow registration, publication, deprecation, and rollback actions

The normalized ledger view is intentionally query-oriented and immutable from the caller side.

### 2. Evidence-Linked Decision History

Approval decisions are now queryable through an explicit decision-history model that preserves:

- workflow and instance identity
- step and step-run identity
- approval-session and round identity
- deciding actor and decision outcome
- decision payload and notes
- direct evidence references
- linked runtime audit-entry IDs

This gives the delivery team a stable path to expose review history later without reverse-engineering raw runtime arrays.

### 3. Evidence Link Index

The workflow package can now build an evidence-link index for an instance by combining:

- trigger-time evidence references
- audit-entry evidence attachments
- approval-decision evidence references

Each evidence-link record shows where a reference was seen first, where it was last seen, and which decisions or audit entries it is linked to.

## Public Interface

The workflow package now exposes:

- `createWorkflowAuditLedgerService(...)`

The audit-ledger service provides:

- `listRuntimeAuditEntries(filters)`
- `listGovernanceAuditEntries(filters)`
- `listAuditLedger(filters)`
- `getDecisionHistory(instanceId)`
- `listEvidenceLinks(instanceId)`
- `getInstanceAuditView(instanceId)`

## Runtime Alignment

To support stable audit linkage, approval decision audit entries now carry:

- `approvalSessionId`
- `roundId`
- `decisionRecordId`

Committee-round audit entries now also carry:

- `approvalSessionId`
- `roundId`
- `roundNumber`

This keeps later API and reporting work from having to guess which audit entry belongs to which decision or round.

## Scope Boundary Preserved

This increment does not add:

- durable storage for workflow audit ledgers
- workflow audit APIs
- reporting UI
- export packaging for audit views

Those remain later Phase 2 work.

## Verification

The workflow-engine package now includes audit-ledger tests covering:

- combined governance and runtime ledger projection
- evidence-linked decision history
- stable linkage between decisions and runtime audit entries
- immutable caller-facing audit views

Commands used:

```powershell
npm run phase2:workflow:engine:test
npm run phase2:workflow:validate
npm run ui:baseline:check
```

## References

- Workflow execution engine: `docs/SAQR_Phase2_Workflow_Execution_Engine.md`
- Workflow governance: `docs/SAQR_Phase2_Workflow_Governance.md`
- Workflow domain contract: `docs/contracts/saqr-workflow-domain.yaml`
