# SAQR Phase 2 Multi-Entity Domain Model

Date: 2026-04-08
Scope: `P2-201`

## Purpose

This document defines the first concrete multi-entity foundation for Phase 2. It turns the previously reserved scope fields into a canonical backend hierarchy model for `group`, `entity`, `businessUnit`, `site`, and `silo`.

This increment is intentionally backend-only. It does not authorize UI redesign, and it does not assume a live tenant store, IdP, or delivery-managed infrastructure inside this repository.

## Guardrails Preserved

- The current demo environment remains intact.
- The Phase 1 production-ready baseline remains the stable implementation handoff.
- UI/UX remains frozen unless a specific change is jointly approved.
- Only free and open-source-compatible tooling is used.
- This increment defines hierarchy only; scoping, isolation, and reporting are layered in later tasks.

## What `P2-201` Completes

- Defines the canonical hierarchy levels and their parent rules.
- Defines the canonical scope field mapping used across Phase 2.
- Adds a reusable backend module for hierarchy validation, lineage building, and scope resolution.
- Adds a reference hierarchy fixture for delivery-team implementation alignment.
- Adds a CLI validation entrypoint so the model can be checked headlessly.

Authoritative artifacts created in this increment:

- `shared/entity-hierarchy.js`
- `fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json`
- `tools/phase2-entity/validate-entity-hierarchy.js`
- `docs/contracts/saqr-entity-hierarchy.yaml`

## Canonical Hierarchy Levels

| Level | Scope Field | Meaning | Allowed Parent Levels |
|---|---|---|---|
| `group` | `groupId` | Top-level group or holding-company boundary | none |
| `entity` | `entityId` | Legal entity or licensed company | `group` |
| `businessUnit` | `businessUnitId` | Operating division inside one legal entity | `entity` |
| `site` | `siteId` | Physical or logical operating site | `entity`, `businessUnit` |
| `silo` | `siloId` | Finest-grained operating zone | `site` |

Two rules matter most:

- `site` is intentionally flexible and may sit directly under a legal entity or under a business unit.
- `silo` is intentionally strict and may only sit under a site.

## Domain Model Summary

### Hierarchy Document

The source document is a versioned hierarchy definition with:

- `hierarchyKey`
- `version`
- `status`
- `nodes`

Each node carries:

- `nodeId`
- `level`
- `name`
- optional `scopeField`
- optional `code`
- optional `description`
- optional `status`
- optional `parentNodeId`
- optional `metadata`

### Derived Catalog

The reusable backend module compiles the source document into a catalog with:

- normalized nodes
- `lineage` for every node
- `ancestorNodeIds`
- `childNodeIds`

This is the key implementation boundary for later tasks. Future scoping and isolation logic should not rebuild lineage ad hoc; it should consume the catalog.

## Scope Resolution Behavior

The model supports partial scopes such as:

- `siteId` only
- `entityId + siloId`
- `groupId + entityId + businessUnitId`

Resolution rules:

1. The deepest provided scope field is treated as the anchor node.
2. The engine resolves the full lineage from that node upward.
3. Any higher-level fields supplied by the caller must match the resolved lineage.
4. Unknown node IDs or conflicting parent lineage are rejected.

This gives later phases one deterministic way to resolve scope without needing a live org tree in the repo.

## Current Repo Truth After This Increment

- The workflow contracts no longer carry entity scope as a purely reserved placeholder. They now have a canonical hierarchy reference.
- The current UI still contains silo-oriented session context, but that is not the authoritative multi-entity model.
- The backend hierarchy contract is now the source of truth for later Phase 2 scoping and roll-up work.

## Scope Boundary

This increment does **not** yet implement:

- user-to-entity scoping rules
- alert, evidence, and workflow access boundaries
- cross-entity isolation enforcement
- portfolio roll-up logic
- sovereign residency or deployment policy rules

Those remain the correct scope of `P2-202` and later tasks.

## Reference Fixture

The bundled reference hierarchy intentionally demonstrates:

- one top-level group
- multiple legal entities
- a business-unit path
- a direct site-under-entity path
- two silo nodes
- a deliberate cross-entity branch used by tests to prove conflict detection

Reference artifact:

- `fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json`

## Validation Path

Commands added in this increment:

- `npm run phase2:entity:validate`
- `npm run phase2:entity:test`

These validate the reference hierarchy and verify lineage, ancestor traversal, descendant traversal, and conflicting-scope rejection.

## Delivery-Team Interpretation

Delivery teams should treat this increment as the canonical Phase 2 starting point for all multi-entity design:

- reuse the exact scope field names
- preserve the level and parent rules
- use the derived lineage model instead of inventing custom scope stitching
- build later scoping, reporting, and sovereign packaging on top of this contract

## Phase 2 Closeout

This workstream now closes through the Phase 2 handoff package:

- `docs/handoff/README.md`
- `docs/handoff/SAQR_Phase2_Handoff_Summary.md`
- `docs/handoff/SAQR_Phase2_Validation_Guide.md`

## References

- Main tracker: `docs/SAQR_Phase_1_Phase_2_Tracker.md`
- Phase 2 roadmap: `docs/SAQR_Phase2_Roadmap.md`
- Phase 2 checklist: `docs/checklists/SAQR_Phase2_Execution_Checklist.md`
- Entity reporting model: `docs/SAQR_Phase2_Entity_Reporting_Model.md`
- Sovereign topology model: `docs/SAQR_Phase2_Sovereign_Topology_Model.md`
- Sovereign policy model: `docs/SAQR_Phase2_Sovereign_Policy_Model.md`
- Sovereign packaging model: `docs/SAQR_Phase2_Sovereign_Packaging_Model.md`
- Entity scoping model: `docs/SAQR_Phase2_Entity_Scoping_Model.md`
- Workflow foundations: `docs/SAQR_Phase2_Workflow_Foundations.md`
- Workflow domain contract: `docs/contracts/saqr-workflow-domain.yaml`
- Workflow event contract: `docs/contracts/saqr-workflow-events.yaml`
- Entity hierarchy contract: `docs/contracts/saqr-entity-hierarchy.yaml`
