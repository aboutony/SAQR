# SAQR Phase 2 Entity Scoping Model

Date: 2026-04-08
Scope: `P2-202`

## Purpose

This document defines how the Phase 2 multi-entity hierarchy scopes principals, workflows, alerts, evidence, and reporting. It turns the hierarchy from `P2-201` into an explicit access model without yet claiming full isolation or portfolio roll-up behavior.

This increment remains backend-only and preserves all existing UI/UX guardrails.

## What `P2-202` Completes

- Defines the principal and grant model for scope-aware access.
- Defines how workflows, alerts, evidence, and reports inherit or declare scope.
- Defines the access-evaluation rules used to match a principal grant to a resource scope.
- Adds a reusable backend scoping module, reference scoping fixture, and CLI validator.

Authoritative artifacts created in this increment:

- `shared/entity-scoping.js`
- `fixtures/phase2-entity/scoping/saqr-reference-entity-scoping.scoping.json`
- `tools/phase2-entity/validate-entity-scoping.js`
- `docs/contracts/saqr-entity-scoping.yaml`

## Scoping Model Summary

### Principal Model

Each principal carries:

- `principalId`
- `principalType`
- `displayName`
- `homeScope`
- one or more explicit `grants`

`homeScope` is descriptive and gives the principal a canonical home position in the hierarchy. Access is still driven by explicit grants, not by home scope alone.

### Grant Model

Each grant binds:

- `resourceTypes`
- `actions`
- `scopeAccess`
- `scope`

The current increment supports three scope-access modes:

| Mode | Meaning |
|---|---|
| `exact` | Access only to the exact anchor scope |
| `self_and_descendants` | Access to the anchor scope plus all descendant scopes |
| `self_and_ancestors` | Access to the anchor scope plus all ancestor scopes |

## Resource Scoping Rules

### Users and Services

- Principals are placed in the hierarchy through `homeScope`.
- Principals act through explicit grants.
- No implicit sibling access exists.

### Workflows

- Workflow definitions may use `entityScopeTemplate`.
- Workflow instances use exact runtime `entityScope`.
- Launch, approval, remediation, and administration are evaluated against explicit workflow grants.

### Alerts

- Alert scope is inherited from the normalized source event.
- Alert readers and operators must have a matching alert grant for that scope lineage.

### Evidence

- Evidence scope is inherited from the evidence-producing source lineage or linked alert.
- Evidence visibility follows the same explicit-grant rules as alerts.

### Reports

- Report requests declare a target scope.
- The target scope must fall within an explicit reporting grant.
- Cross-sibling and cross-entity portfolio aggregation is not yet part of this increment.

## Current Repo Truth After This Increment

- The hierarchy is no longer enough on its own; the repo now also has a canonical principal-to-resource scoping model.
- Workflow, alert, evidence, and reporting scope can now be evaluated headlessly against explicit grants.
- The model is still contract-first and in-memory. Runtime and storage isolation boundaries are now layered separately in `docs/contracts/saqr-entity-isolation.yaml`.

## Reference Scoping Fixture

The bundled reference scoping model demonstrates:

- group-level oversight across all descendants
- entity-bounded operational workflow and evidence access
- site-local investigative access
- board-level reporting access without implied operational rights

Reference artifact:

- `fixtures/phase2-entity/scoping/saqr-reference-entity-scoping.scoping.json`

## Validation Path

Commands available after this increment:

- `npm run phase2:entity:scope:validate`
- `npm run phase2:entity:test`

The test coverage validates:

- reference-model validity
- descendant access behavior
- sibling-entity denial
- reporting-scope expansion through descendants
- invalid grant rejection

## Scope Boundary

This increment does **not** yet implement:

- storage or runtime tenant isolation
- per-entity database partitioning
- cross-entity portfolio roll-up rules
- executive reporting contracts
- sovereign topology or residency policy rules

Those remain the correct scope of later Phase 2 tasks.

## Delivery-Team Interpretation

Delivery teams should use this model as the canonical rule set when wiring:

- principal-to-scope grants
- workflow authorization boundaries
- alert and evidence visibility
- report-request scope checks

The key rule is simple: access is explicit-grant based, lineage-aware, and never lateral by default.

## Phase 2 Closeout

This workstream now closes through the Phase 2 handoff package:

- `docs/handoff/README.md`
- `docs/handoff/SAQR_Phase2_Handoff_Summary.md`
- `docs/handoff/SAQR_Phase2_Validation_Guide.md`

## References

- Main tracker: `docs/SAQR_Phase_1_Phase_2_Tracker.md`
- Phase 2 checklist: `docs/checklists/SAQR_Phase2_Execution_Checklist.md`
- Multi-entity domain model: `docs/SAQR_Phase2_Multi_Entity_Domain_Model.md`
- Entity reporting model: `docs/SAQR_Phase2_Entity_Reporting_Model.md`
- Sovereign topology model: `docs/SAQR_Phase2_Sovereign_Topology_Model.md`
- Sovereign policy model: `docs/SAQR_Phase2_Sovereign_Policy_Model.md`
- Sovereign packaging model: `docs/SAQR_Phase2_Sovereign_Packaging_Model.md`
- Entity isolation model: `docs/SAQR_Phase2_Entity_Isolation_Model.md`
- Entity hierarchy contract: `docs/contracts/saqr-entity-hierarchy.yaml`
- Entity scoping contract: `docs/contracts/saqr-entity-scoping.yaml`
