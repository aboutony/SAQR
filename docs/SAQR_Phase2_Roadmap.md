# SAQR Phase 2 Roadmap

Date: 2026-04-07
Scope: Phase 2 planning baseline

## Purpose

This document turns the approved Phase 2 direction into an execution-ready roadmap. It is the planning companion to the main tracker and should be used to understand sequencing, scope boundaries, and what "done" should mean before implementation starts.

## Phase 2 Objectives

Phase 2 adds only these two strategic functions:

- LogicGate-style no-code workflow engine
- Archer-style multi-entity and sovereign deployment model

## Carry-Forward Guardrails

- The current demo environment must remain intact.
- The production-ready Phase 1 baseline must not be destabilized.
- UI/UX remains frozen unless a specific Phase 2 change is jointly approved.
- All new functions must remain delivery-ready and documentation-backed.
- Free and open-source-compatible tooling remains mandatory.

## Phase 2 Workstreams

### 1. No-Code Workflow Engine

Target outcome:

- SAQR alerts and evidence can trigger configurable workflows.
- Approval chains, maker-checker controls, SLAs, reminders, and escalations are handled by a controlled backend engine.
- Workflow history, decision logs, and evidence links are preserved for auditability.

### 2. Multi-Entity and Sovereign Model

Target outcome:

- SAQR can model group, legal entity, business unit, site, and silo boundaries.
- Data, alerts, workflows, and reporting can be scoped and rolled up correctly.
- Delivery packaging can support sovereign cloud, per-country, and on-prem deployment patterns.

## Roadmap Table

| Workstream | Sequence | Focus | Tracker IDs | Exit Condition |
|---|---|---|---|---|
| Governance and kickoff | First | Lock planning baseline, acceptance rules, and execution order | `P2-001` to `P2-002` | Scope is frozen enough to begin implementation safely |
| Workflow foundations | First | Domain model, event contracts, workflow schema/DSL | `P2-101` to `P2-103` | Workflow definitions are explicit and validated |
| Workflow engine core | Second | Runtime execution, approvals, SLAs, escalations | `P2-104` to `P2-106` | Workflow logic can execute and be tested headlessly |
| Workflow governance and integration | Third | Versioning, audit history, contracts, UI-safe exposure | `P2-107` to `P2-110` | Workflow platform is controlled, testable, and integration-ready |
| Multi-entity foundations | Parallel after workflow foundations | Hierarchy, scoping, isolation boundaries | `P2-201` to `P2-203` | Entity boundaries are explicit and enforceable |
| Multi-entity reporting | After foundations | Roll-up logic and executive reporting model | `P2-204` to `P2-205` | Group-level views are contract-defined |
| Sovereign deployment model | After entity foundations | Topology patterns, residency and policy model, packaging extensions | `P2-206` to `P2-208` | Delivery topology patterns are documented and package-ready |
| Validation and handoff | Final | Fixtures, quality gates, docs, and handoff package | `P2-301` to `P2-304` | Phase 2 can be handed off with the same discipline as Phase 1 |

## Recommended Build Order

1. Start with workflow foundations, not UI.
2. Build the workflow execution engine and audit model before exposing anything visually.
3. Define the multi-entity scoping model before building cross-entity reporting.
4. Treat sovereign deployment as a packaging and policy layer on top of the entity model, not as a separate disconnected track.
5. Add UI exposure only after backend contracts and approval gates are clear.
6. Finish with validation, docs, and handoff assets.

## Phase 2 Done Means

- Workflow logic is configurable and no longer hard-coded into ad hoc paths.
- Enterprise routing, approvals, SLAs, and audit trails exist behind explicit contracts.
- Multi-entity scoping and aggregation are implementation-ready and test-backed.
- Sovereign deployment patterns are defined clearly enough for delivery packaging and client architecture.
- UI changes, if any, are minimal, approved, and regression-guarded.
- A formal Phase 2 validation and handoff package exists.

## Primary References

- Main tracker: `docs/SAQR_Phase_1_Phase_2_Tracker.md`
- Phase 2 checklist: `docs/checklists/SAQR_Phase2_Execution_Checklist.md`
- Workflow foundations: `docs/SAQR_Phase2_Workflow_Foundations.md`
- Workflow DSL and validation: `docs/SAQR_Phase2_Workflow_DSL_and_Validation.md`
- Workflow execution engine: `docs/SAQR_Phase2_Workflow_Execution_Engine.md`
- Approval routing engine: `docs/SAQR_Phase2_Approval_Routing_Engine.md`
- SLA automation layer: `docs/SAQR_Phase2_SLA_Automation.md`
- Workflow governance: `docs/SAQR_Phase2_Workflow_Governance.md`
- Workflow audit model: `docs/SAQR_Phase2_Workflow_Audit_Model.md`
- UI-safe integration plan: `docs/SAQR_Phase2_UI_Safe_Integration_Plan.md`
- Workflow contract package: `docs/SAQR_Phase2_Workflow_Contract_Package.md`
- Workflow domain contract: `docs/contracts/saqr-workflow-domain.yaml`
- Workflow event contract: `docs/contracts/saqr-workflow-events.yaml`
- Workflow DSL contract: `docs/contracts/saqr-workflow-dsl.yaml`
- Phase 1 handoff baseline: `docs/handoff/README.md`
