# SAQR Phase 2 Approval Routing Engine

Date: 2026-04-07
Scope: `P2-105`

## Purpose

This document closes `P2-105` by defining the approval-routing model now implemented in the workflow engine.

This increment is backend-only. The UI/UX baseline remains untouched.

## What Was Added

Approval-routing capabilities were added to:

- `services/workflow-engine/src/runtime-core.js`
- `services/workflow-engine/src/actor-directory.js`
- `services/workflow-engine/src/index.js`
- `services/workflow-engine/src/runtime.test.js`

Reference examples and contracts were also updated in:

- `docs/contracts/saqr-workflow-domain.yaml`
- `docs/contracts/saqr-workflow-dsl.yaml`
- `fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json`
- `fixtures/phase2-workflow/workflows/cross-authority-committee-review.workflow.json`

## Approval-Routing Model

### Assignment Resolution

The engine now resolves `assign` and `approve` steps through selector grammar:

- `user`
- `role`
- `queue`

Resolution stays provider-driven through the actor-directory contract. The current implementation uses an in-memory provider for deterministic local testing and delivery-team reference behavior.

### Maker-Checker

`maker_checker` mode now blocks approvals from actors disallowed by `makerCheckerScope`.

Current implemented scope behavior:

- `blockInstanceOriginActor`
- `blockTriggerActor`

Compatibility handling remains in place for older `segregationOfDuties` authoring.

### Explicit Delegation

Delegation now works only through explicit delegate resolution:

- the delegating actor must be an active assignee in the current approval round
- the delegate target must be present in the resolved explicit delegate set
- invalid delegation attempts are rejected and audited

### Fixed-Quorum Committee Approval

`parallel_committee` now behaves as a fixed-quorum approval model:

- `minimumApprovals` defines required quorum
- approval completes only when quorum is met
- rejection happens only when quorum becomes impossible with remaining eligible approvers
- duplicate decisions from the same actor in the same round are rejected

### Committee Escalation

Escalation now opens a new approval round from `committeeSelectors` and preserves all prior-round history.

This is an internal approval-routing behavior only. It does not yet dispatch reminders, webhook notifications, or SLA automation.

## Runtime Interfaces Exposed

The workflow engine now exposes:

- `createWorkflowExecutionService(...)`
- `resolveCurrentAssignments(instanceId)`
- `reassignCurrentStep(instanceId, command)`
- `delegateApproval(instanceId, command)`
- `recordApprovalDecision(instanceId, command)`
- `escalateApprovalToCommittee(instanceId, command)`

## Verification Coverage

The engine test suite now covers:

- deterministic assignment resolution across queue, role, and user selectors
- maker-checker blocking
- explicit delegation success and failure
- first-approval / first-rejection completion behavior
- fixed-quorum committee approval success
- committee rejection on quorum impossibility
- escalation into a new committee round
- duplicate actor-decision rejection
- reassignment without breaking audit history

## Scope Boundary Preserved

This increment does not add:

- durable persistence
- SLA timers or reminders
- automatic escalation dispatch
- workflow APIs
- UI workflow controls

Those remain later Phase 2 work.

## References

- Workflow execution engine: `docs/SAQR_Phase2_Workflow_Execution_Engine.md`
- Workflow DSL and validation: `docs/SAQR_Phase2_Workflow_DSL_and_Validation.md`
- Workflow domain contract: `docs/contracts/saqr-workflow-domain.yaml`
- Workflow DSL contract: `docs/contracts/saqr-workflow-dsl.yaml`
