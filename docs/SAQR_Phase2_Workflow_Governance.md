# SAQR Phase 2 Workflow Governance

Date: 2026-04-07
Scope: `P2-107`

## Purpose

This document closes `P2-107` by defining the workflow-governance controls now implemented for versioning, publishing, rollback, and change history.

This increment remains backend-only. No UI or UX changes were introduced.

## What Was Added

Workflow governance now lives in:

- `services/workflow-engine/src/governance.js`
- `services/workflow-engine/src/governance.test.js`
- `services/workflow-engine/src/index.js`

## Governance Capabilities Now Implemented

### 1. Definition Registration

The governance service can register workflow definitions as in-memory version records while preserving:

- `workflowKey`
- `version`
- `status`
- `publishControls.changeSummary`
- `publishControls.approvalRecordRequired`

### 2. Draft Version Creation

The service can create a new draft version from an existing version using:

- source version reference
- required change summary
- optional definition patch
- optional override for approval-record requirement

This provides controlled version incrementation instead of ad hoc mutation of published definitions.

### 3. Controlled Publication

The service can publish a workflow version and enforce:

- one published version per `workflowKey`
- required approval record when `approvalRecordRequired` is true
- automatic deprecation of the previously published version
- publish timestamp recording

### 4. Rollback as a New Version

Rollback now creates a new version rather than mutating an older one in place.

The rollback path:

- clones the target version into a new draft version
- sets `publishControls.rollbackOfVersion`
- records rollback history
- publishes the new version through the same approval-aware publish path

### 5. Change History

The governance service records structured history entries for:

- definition registration
- draft creation
- publication
- deprecation
- rollback creation

This gives the delivery team a controlled lifecycle ledger even before durable persistence exists.

That lifecycle history is now also consumable through the normalized audit-ledger service added in `P2-108`.

## Public Interface

The workflow package now exposes:

- `createWorkflowGovernanceService(...)`

The governance service provides:

- `registerDefinition(definition, options)`
- `createDraftVersion(workflowKey, options)`
- `publishWorkflowVersion(workflowKey, version, options)`
- `rollbackWorkflowVersion(workflowKey, targetVersion, options)`
- `listWorkflowKeys()`
- `listWorkflowVersions(workflowKey)`
- `getWorkflowVersion(workflowKey, version)`
- `getPublishedWorkflow(workflowKey)`
- `getPublishedDefinitions()`
- `listChangeHistory(filters)`

## Scope Boundary Preserved

This increment does not add:

- durable persistence of governance history
- API endpoints for governance actions
- no-code authoring UI
- approval workflow for governance actions themselves

Those remain later Phase 2 work.

## Verification

The workflow-engine package now includes governance tests covering:

- initial definition registration
- draft version cloning
- approval-gated publish behavior
- deprecation of replaced published versions
- rollback as a new published version
- published-definition export for runtime consumption

Commands used:

```powershell
npm run phase2:workflow:engine:test
npm run phase2:workflow:validate
npm run ui:baseline:check
```

## References

- Workflow execution engine: `docs/SAQR_Phase2_Workflow_Execution_Engine.md`
- Workflow audit model: `docs/SAQR_Phase2_Workflow_Audit_Model.md`
- Workflow DSL and validation: `docs/SAQR_Phase2_Workflow_DSL_and_Validation.md`
- Workflow domain contract: `docs/contracts/saqr-workflow-domain.yaml`
- Workflow DSL contract: `docs/contracts/saqr-workflow-dsl.yaml`
