# SAQR Phase 2 Workflow Contract Package

Date: 2026-04-07
Scope: `P2-110`

## Purpose

This document closes `P2-110` by publishing the workflow API contracts, example fixtures, and backend delivery seams that now sit between the Phase 2 workflow engine and the API layer.

This increment remains backend-only. No UI or UX changes were introduced.

## What Was Added

### API delivery seam

- `apps/api/src/workflow-contract-service.js`
- `apps/api/src/workflow-contract-service.test.js`

### Contract artifacts

- `docs/contracts/saqr-workflow-api.openapi.yaml`
- `docs/contracts/saqr-workflow-fixtures.yaml`

### Example request and response fixtures

- `fixtures/phase2-workflow/contracts/requests/workflow-event-match.request.json`
- `fixtures/phase2-workflow/contracts/requests/workflow-event-start.request.json`
- `fixtures/phase2-workflow/contracts/requests/workflow-governance-publish.request.json`
- `fixtures/phase2-workflow/contracts/responses/workflow-definitions.list.response.json`
- `fixtures/phase2-workflow/contracts/responses/workflow-instance-audit.response.json`

## Delivery Seam Capabilities Now Implemented

The API-side seam can now:

- load bundled workflow definition fixtures
- validate workflow-definition documents against the Phase 2 DSL
- expose published definition views for delivery work
- match normalized events to published workflows
- start workflow instances through the workflow runtime
- expose combined audit views, decision history, and evidence links
- create draft versions, publish workflow versions, and rollback versions through one in-process contract seam
- resync newly published definitions back into the runtime matcher without resetting the seam itself

## Public Interface

The delivery seam now exposes:

- `createWorkflowContractService(...)`

The service provides:

- `listDefinitionFixtures()`
- `listDefinitions(filters)`
- `getWorkflowDefinition(workflowKey, options)`
- `validateDefinitionDocument(document, sourceName)`
- `matchEvent(event)`
- `startForEvent(event, options)`
- `listInstances()`
- `getInstance(instanceId)`
- `getInstanceAuditView(instanceId)`
- `listAuditLedger(filters)`
- `listDecisionHistory(instanceId)`
- `listEvidenceLinks(instanceId)`
- `listGovernanceHistory(filters)`
- `createDraftVersion(workflowKey, options)`
- `publishWorkflowVersion(workflowKey, version, options)`
- `rollbackWorkflowVersion(workflowKey, targetVersion, options)`

## Scope Boundary Preserved

This increment does not claim:

- that the Fastify server has already mounted the workflow routes
- durable workflow persistence in the API layer
- workflow UI exposure
- approval to modify tracked UI files

The point of `P2-110` is to publish the contract package and backend seam so delivery can wire the HTTP surface cleanly.

## Verification

The API package now includes workflow contract tests covering:

- bundled fixture loading
- published definition views
- definition validation
- event match and instance start flow
- audit-view retrieval
- governance publication syncing back into runtime matching

Commands used:

```powershell
npm --prefix apps/api test
npm run phase2:workflow:validate
npm --prefix apps/shield-ui run ui:baseline:check
```

## References

- Workflow execution engine: `docs/SAQR_Phase2_Workflow_Execution_Engine.md`
- Workflow governance: `docs/SAQR_Phase2_Workflow_Governance.md`
- Workflow audit model: `docs/SAQR_Phase2_Workflow_Audit_Model.md`
- Workflow UI-safe plan: `docs/SAQR_Phase2_UI_Safe_Integration_Plan.md`
