# SAQR Phase 2 Entity Roll-Up Model

Date: 2026-04-08
Scope: `P2-204`

## Purpose

This document defines how inherited controls and portfolio summaries roll up across the Phase 2 multi-entity hierarchy. It does not define the final executive reporting API yet; it defines the aggregation logic that later reporting contracts will expose.

This increment remains backend-only and preserves all existing UI/UX guardrails.

## What `P2-204` Completes

- Defines the control-definition, control-assignment, and exact-assessment model for portfolio roll-up.
- Defines inherited-control behavior from ancestor scopes to descendant nodes.
- Defines node-level and portfolio-level aggregation outputs.
- Adds a reusable backend roll-up module, reference roll-up fixture, and CLI validator.

Authoritative artifacts created in this increment:

- `shared/entity-rollup.js`
- `fixtures/phase2-entity/rollups/saqr-reference-portfolio-rollup.rollup.json`
- `tools/phase2-entity/validate-entity-rollup.js`
- `docs/contracts/saqr-entity-rollup.yaml`

## Roll-Up Model Summary

### Three Inputs

The model combines three input layers:

1. `controlDefinitions`
2. `controlAssignments`
3. `controlAssessments`

Definitions describe the control itself. Assignments attach the control to a scope. Assessments record the exact observed state at one node.

### Inheritance Rule

- `inherit_to_descendants` applies to the assignment node and all descendants.
- `local_only` applies only at the assignment node.
- If the same control is assigned from multiple ancestors, the most specific assignment wins.

### Assessment Rule

- Assessments are exact to one node.
- Assessments do not automatically cascade to descendants.
- If a control applies to a node but no exact assessment exists there, the effective status is `not_assessed`.

This keeps the aggregation logic honest. A good result at one site should not silently mark all child silos compliant unless they were actually assessed.

## Output Shapes

### Node Summary

Each node summary includes:

- total controls
- direct control count
- inherited control count
- status counts
- overall status
- effective control states

### Portfolio Summary

Each portfolio roll-up includes:

- root node
- total node count
- overall portfolio status
- node-status counts
- per-control aggregation with direct and inherited coverage counts
- per-node summaries

## Reference Model

The bundled reference roll-up demonstrates:

- one group-wide inherited control
- one bank-entity inherited control
- one site-local control
- one insurance-entity inherited control
- exact assessments at selected entity, site, and silo nodes

This lets the delivery team test:

- inherited control visibility at descendants
- local-only control boundaries
- portfolio overall-status roll-up
- control-level status aggregation across a subtree

## Current Repo Truth After This Increment

- The repo now has a canonical inherited-control model instead of only raw scope lineage and access rules.
- Portfolio aggregation is implementation-ready and test-backed.
- Executive reporting is now defined separately in `docs/SAQR_Phase2_Entity_Reporting_Model.md`.

## Validation Path

Commands available after this increment:

- `npm run phase2:entity:rollup:validate`
- `npm run phase2:entity:test`

The test coverage validates:

- reference-model validity
- inherited vs local-only control resolution
- node-level overall status
- portfolio-level control aggregation
- invalid duplicate exact assessments

## Scope Boundary

This increment does **not** yet implement:

- executive reporting API shape
- final board or group dashboard contracts
- sovereign deployment patterns
- residency and cross-border movement rules

Those remain the correct scope of later Phase 2 tasks.

## Delivery-Team Interpretation

Delivery teams should treat this as the canonical engine for:

- inherited control propagation
- per-node control status calculation
- subtree health aggregation
- executive reporting exposure through the separate `P2-205` reporting contract

The blunt rule is: assignments inherit, assessments do not, and roll-ups aggregate the effective results.

## Phase 2 Closeout

This workstream now closes through the Phase 2 handoff package:

- `docs/handoff/README.md`
- `docs/handoff/SAQR_Phase2_Handoff_Summary.md`
- `docs/handoff/SAQR_Phase2_Validation_Guide.md`

## References

- Main tracker: `docs/SAQR_Phase_1_Phase_2_Tracker.md`
- Phase 2 checklist: `docs/checklists/SAQR_Phase2_Execution_Checklist.md`
- Entity reporting model: `docs/SAQR_Phase2_Entity_Reporting_Model.md`
- Sovereign topology model: `docs/SAQR_Phase2_Sovereign_Topology_Model.md`
- Sovereign policy model: `docs/SAQR_Phase2_Sovereign_Policy_Model.md`
- Sovereign packaging model: `docs/SAQR_Phase2_Sovereign_Packaging_Model.md`
- Entity hierarchy contract: `docs/contracts/saqr-entity-hierarchy.yaml`
- Entity scoping contract: `docs/contracts/saqr-entity-scoping.yaml`
- Entity isolation contract: `docs/contracts/saqr-entity-isolation.yaml`
- Entity roll-up contract: `docs/contracts/saqr-entity-rollup.yaml`
