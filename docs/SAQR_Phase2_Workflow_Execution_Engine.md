# SAQR Phase 2 Workflow Execution Engine

Date: 2026-04-07
Scope: `P2-104` to `P2-108`

## Purpose

This document defines what the current workflow engine now does in-repo after the approval-routing extension landed in `P2-105`.

This remains a backend-first increment. No UI changes were introduced.

## Service Package

- `services/workflow-engine`

Core runtime artifacts:

- `services/workflow-engine/src/runtime-core.js`
- `services/workflow-engine/src/runtime.js`
- `services/workflow-engine/src/actor-directory.js`
- `services/workflow-engine/src/governance.js`
- `services/workflow-engine/src/audit-ledger.js`
- `services/workflow-engine/src/index.js`
- `services/workflow-engine/src/runtime.test.js`
- `services/workflow-engine/src/governance.test.js`
- `services/workflow-engine/src/audit-ledger.test.js`

## Runtime Capabilities Now Implemented

### 1. Definition Registration and Event Matching

The engine can:

- register workflow definitions
- normalize workflow structures into runtime lookup maps
- validate inbound normalized events
- match normalized events to published workflow definitions
- start workflow instances idempotently by `workflowKey + idempotencyKey`

### 2. Deterministic Step Execution

The runtime can:

- activate entry steps
- advance deterministic transitions
- complete instances on terminal `null` transitions
- cancel, breach, and resume instances
- preserve per-attempt step-run history for loops and retries

### 3. Provider-Driven Assignment Resolution

The engine now resolves selectors through an actor-directory provider interface:

- `resolveSelectors(selectors, context)`
- `resolveDelegates(actor, selectors, context)`
- `actorHasRole(actor, roleKey)`

The current repo implementation uses an in-memory provider for tests and delivery-ready reference behavior only. No live IdP or directory dependency was introduced.

### 4. Approval Sessions and Rounds

Approval-capable steps now open a structured approval session with:

- one active approval session per active approval step
- one active round at a time
- explicit assignment records
- per-round decision records
- preserved round history during escalation

Runtime data now includes:

- `approvalSession`
- `approvalRound`
- `approvalAssignment`
- `approvalDecisionRecord`

### 5. Approval Modes Implemented

#### `single`

- resolves approvers
- approves on first approval
- rejects on first rejection

#### `maker_checker`

- behaves like `single`
- blocks conflicted actors according to `makerCheckerScope`
- remains provider-driven and backend-only

#### `delegated`

- behaves like `single`
- allows reassignment only through explicit delegate resolution
- rejects invalid delegate targets and records that denial in audit history

#### `parallel_committee`

- opens a committee-style round
- records one decision per actor per round
- reaches approval only when fixed quorum is met
- reaches rejection only when quorum becomes impossible with remaining eligible approvers

### 6. Committee Escalation

The engine now supports explicit approval escalation into a new committee round:

- prior-round history is preserved
- prior-round status is marked as escalated
- a new round is opened from `committeeSelectors`
- current-step assignment state is updated to the active committee round

### 7. In-Memory Audit Trail

The runtime now records audit entries for:

- instance creation
- step start
- assignment resolution
- assignment changes
- approval request
- approval decision recording
- approval delegation
- approval delegation denial
- approval escalation
- committee round opened
- step completion
- evidence attachment
- SLA breach marker
- instance completion
- instance cancellation

### 8. Deterministic SLA Monitoring

The engine now supports a headless SLA-monitoring layer through runtime APIs rather than a background daemon.

Current SLA behavior now includes:

- reminder intervals
- warning threshold evaluation
- breach threshold evaluation
- pause-aware elapsed-time tracking
- escalation-policy execution on `sla_warning` and `sla_breach`
- optional next-step override on automated escalation

## Scope Boundary

What this engine now includes:

- deterministic workflow execution
- provider-driven assignment resolution
- maker-checker enforcement
- explicit delegation
- fixed-quorum committee approval
- committee escalation with preserved round history
- in-memory audit records

What this engine still does not claim:

- durable persistence of workflow instances or approval sessions
- workflow HTTP or API surface
- no-code admin UI
- live identity-provider integration

Those remain correctly staged for later Phase 2 tasks, starting with `P2-201`.

## Verification

Run the workflow-definition validator:

```powershell
npm run phase2:workflow:validate
```

Run the workflow DSL tests:

```powershell
npm run phase2:workflow:test
```

Run the workflow engine tests:

```powershell
npm run phase2:workflow:engine:test
```

Run the UI freeze check:

```powershell
npm run ui:baseline:check
```

## References

- Workflow DSL and validation: `docs/SAQR_Phase2_Workflow_DSL_and_Validation.md`
- Approval routing engine: `docs/SAQR_Phase2_Approval_Routing_Engine.md`
- SLA automation layer: `docs/SAQR_Phase2_SLA_Automation.md`
- Workflow governance: `docs/SAQR_Phase2_Workflow_Governance.md`
- Workflow audit model: `docs/SAQR_Phase2_Workflow_Audit_Model.md`
- Workflow domain contract: `docs/contracts/saqr-workflow-domain.yaml`
- Workflow DSL contract: `docs/contracts/saqr-workflow-dsl.yaml`
