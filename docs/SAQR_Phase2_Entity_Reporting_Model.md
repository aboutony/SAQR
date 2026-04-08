# SAQR Phase 2 Entity Reporting Model

Date: 2026-04-08
Scope: `P2-205`

## Purpose

This document defines the cross-entity reporting layer for the Phase 2 multi-entity model. It turns the hierarchy, scoping, isolation, and roll-up contracts into named executive reporting views that can be generated headlessly without changing the UI.

This increment remains backend-only and preserves all existing UI/UX guardrails.

## What `P2-205` Completes

- Defines the reporting-model document for named executive and portfolio report views.
- Defines the dependency contract between reporting and the hierarchy, scoping, isolation, and roll-up models.
- Adds a reusable backend reporting module, reference reporting fixture, and CLI validator.
- Defines the read-only aggregation output shape for executive reporting consumers.

Authoritative artifacts created in this increment:

- `shared/entity-reporting.js`
- `shared/entity-reporting.test.js`
- `fixtures/phase2-entity/reports/saqr-reference-executive-reporting.report.json`
- `tools/phase2-entity/validate-entity-reporting.js`
- `docs/contracts/saqr-entity-reporting.yaml`

## Reporting Layer Summary

Phase 2 now has five layered multi-entity contracts:

1. Hierarchy: the canonical group-to-silo lineage.
2. Scoping: who is authorized to access which scope.
3. Isolation: what runtime and storage boundary still applies.
4. Roll-up: how control assignments and exact assessments aggregate.
5. Reporting: which named executive views are allowed on top of that aggregated model.

The reporting layer exists to keep executive views explicit. We are not authorizing ad hoc, free-form, cross-entity queries here.

## Supported Report View Types

| View Type | Meaning |
|---|---|
| `executive_summary` | High-level board or group-compliance summary rooted at one allowed node |
| `entity_portfolio` | Portfolio summary for one legal entity and its descendants |
| `control_heatmap` | Control-centric highlight view over one allowed root and descendant set |

## Contract Shape

Each reporting model now defines:

- top-level reporting metadata: `schemaVersion`, `modelKey`, `version`, `name`, `status`
- four dependency references: `hierarchyRef`, `scopingRef`, `isolationRef`, `rollupRef`
- one or more `reportDefinitions`

Each report definition includes:

- `reportKey`
- `name`
- `viewType`
- `targetRootLevels`
- `includeChildLevels`
- `maxControlHighlights`
- `maxNodeHighlights`
- `audienceTags`

This keeps reporting controlled. Delivery teams can add new approved report definitions without changing the UI or inventing new runtime semantics.

## Generation Rules

Report generation in this increment follows these blunt rules:

- the target scope must resolve through the canonical hierarchy
- the resolved root level must be allowed by the selected report definition
- the caller must pass scoping and isolation checks using resource type `report`
- reporting stays on the aggregation plane and remains `aggregate_read_only`
- the engine returns bounded highlight lists instead of unbounded raw datasets

That means the reporting layer is safe for executive views and portfolio summaries, but it is not a shortcut around entity isolation.

## Output Shape

The reporting module returns:

- report identity: `reportKey`, `reportName`, `viewType`
- caller context: `principalId`
- resolved reporting boundary: `boundaryMode`, `rootNodeId`, `rootLevel`, `rootScope`
- aggregate status: `overallStatus`, `nodeCount`, `nodeStatusCounts`
- bounded highlights: `controlHighlights`, `nodeHighlights`

This is enough for delivery teams to expose stable executive reporting APIs later without redefining the aggregation logic.

## Current Repo Truth After This Increment

- The repo now has a canonical, test-backed contract for cross-entity executive reporting.
- Reporting is still intentionally backend-first and fixture-backed.
- Reporting remains read-only and aggregation-plane only.
- No UI workflow or reporting surface was changed in this increment.

## Validation Path

Commands available after this increment:

- `npm run phase2:entity:reporting:validate`
- `npm run phase2:entity:test`

The test coverage validates:

- reference reporting-model validity
- group executive summary generation
- entity portfolio reporting generation
- aggregation-plane access enforcement
- rejection of unsupported report definitions and unsupported root levels

## Scope Boundary

This increment does **not** yet implement:

- sovereign topology patterns
- residency or cross-border policy rules
- client-facing reporting APIs
- approved UI reporting exposure

Those remain delivery-owned post-handoff tasks, not additional repo-scope Phase 2 build work.

## Delivery-Team Interpretation

Delivery teams should treat this model as the canonical contract for:

- approved executive report definitions
- allowed report roots and child-level inclusion
- bounded highlight selection
- reporting access that stays read-only and aggregation-plane only

The blunt rule is: if a report view is not defined here, it is not part of the approved Phase 2 reporting surface.

## Phase 2 Closeout

This workstream now closes through the Phase 2 handoff package:

- `docs/handoff/README.md`
- `docs/handoff/SAQR_Phase2_Handoff_Summary.md`
- `docs/handoff/SAQR_Phase2_Validation_Guide.md`

## References

- Main tracker: `docs/SAQR_Phase_1_Phase_2_Tracker.md`
- Phase 2 checklist: `docs/checklists/SAQR_Phase2_Execution_Checklist.md`
- Phase 2 roadmap: `docs/SAQR_Phase2_Roadmap.md`
- Multi-entity domain model: `docs/SAQR_Phase2_Multi_Entity_Domain_Model.md`
- Entity scoping model: `docs/SAQR_Phase2_Entity_Scoping_Model.md`
- Entity isolation model: `docs/SAQR_Phase2_Entity_Isolation_Model.md`
- Entity roll-up model: `docs/SAQR_Phase2_Entity_Rollup_Model.md`
- Sovereign topology model: `docs/SAQR_Phase2_Sovereign_Topology_Model.md`
- Sovereign policy model: `docs/SAQR_Phase2_Sovereign_Policy_Model.md`
- Sovereign packaging model: `docs/SAQR_Phase2_Sovereign_Packaging_Model.md`
- Entity hierarchy contract: `docs/contracts/saqr-entity-hierarchy.yaml`
- Entity scoping contract: `docs/contracts/saqr-entity-scoping.yaml`
- Entity isolation contract: `docs/contracts/saqr-entity-isolation.yaml`
- Entity roll-up contract: `docs/contracts/saqr-entity-rollup.yaml`
- Entity reporting contract: `docs/contracts/saqr-entity-reporting.yaml`
