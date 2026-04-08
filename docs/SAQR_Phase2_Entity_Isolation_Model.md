# SAQR Phase 2 Entity Isolation Model

Date: 2026-04-08
Scope: `P2-203`

## Purpose

This document defines the runtime and storage isolation layer for the Phase 2 multi-entity model. It sits on top of the hierarchy and scoping contracts and answers a different question: even when access is authorized, what kind of partition boundary must still be enforced?

This increment remains backend-only and preserves all existing UI/UX guardrails.

## What `P2-203` Completes

- Defines partition levels for group-scoped and entity-scoped resources.
- Defines storage-plane semantics for control-plane metadata, entity data, and reporting aggregation.
- Defines direct, brokered, and aggregation-only cross-entity access boundaries.
- Adds a reusable backend isolation module, reference isolation fixture, and CLI validator.

Authoritative artifacts created in this increment:

- `shared/entity-isolation.js`
- `fixtures/phase2-entity/isolation/saqr-reference-entity-isolation.isolation.json`
- `tools/phase2-entity/validate-entity-isolation.js`
- `docs/contracts/saqr-entity-isolation.yaml`

## Layering Rule

Phase 2 now has three different multi-entity layers:

1. Hierarchy: what the canonical scope lineage is.
2. Scoping: who is authorized to act against which resource scopes.
3. Isolation: what runtime or storage boundary still applies even when the authorization layer allows access.

This distinction matters because a group-level oversight grant should not imply unsafe direct mutation across mixed entity partitions.

## Isolation Model Summary

### Partition Levels

| Partition Level | Meaning |
|---|---|
| `group` | Shared control or aggregation boundary at group level |
| `entity` | Tenant data boundary for operational runtime data |

### Storage Planes

| Storage Plane | Meaning |
|---|---|
| `control_plane` | Shared metadata and control records |
| `entity_data_plane` | Entity-partitioned operational and evidence data |
| `aggregation_plane` | Read-only reporting and roll-up views |

### Access Boundary Modes

| Mode | Meaning |
|---|---|
| `same_partition_direct` | Authorized and direct within one resolved partition |
| `brokered_read_only` | Authorized cross-entity read, but only through a brokered fan-out path |
| `aggregate_read_only` | Authorized read on a reporting aggregation plane |

## Reference Policy

The reference isolation model defines:

- `workflow`, `alert`, and `evidence` as `entity_data_plane` resources
- `report` as an `aggregation_plane` resource
- `user` and principal metadata as `control_plane` metadata

That means:

- workflow runtime state is entity-partitioned
- alert and evidence data are entity-partitioned
- reporting is read-only and aggregated
- cross-entity operational mutation is denied

## Current Repo Truth After This Increment

- The repo now has a canonical separation between authorization and runtime isolation.
- Group-wide visibility can be expressed safely without pretending all runtime data should live in one mixed partition.
- Cross-entity oversight is now modeled as brokered or aggregated access, not as unrestricted direct access.

## Validation Path

Commands available after this increment:

- `npm run phase2:entity:isolation:validate`
- `npm run phase2:entity:test`

The test coverage validates:

- reference-model validity
- same-partition direct workflow access
- brokered cross-entity evidence reads
- aggregation-plane reporting access
- denial of cross-entity workflow mutation

## Scope Boundary

This increment does **not** yet implement:

- database topology rollout patterns
- sovereign residency policy rules
- per-country infrastructure placement
- executive reporting contracts
- inherited control aggregation or portfolio roll-up logic

Those remain the correct scope of later Phase 2 tasks.

## Delivery-Team Interpretation

Delivery teams should treat this model as the canonical enforcement layer for:

- tenant partition keys
- direct vs brokered query paths
- reporting-plane separation
- denial of cross-entity mutation against entity data

The blunt rule is: authorization can be broad, but runtime mutation stays partition-local.

## Phase 2 Closeout

This workstream now closes through the Phase 2 handoff package:

- `docs/handoff/README.md`
- `docs/handoff/SAQR_Phase2_Handoff_Summary.md`
- `docs/handoff/SAQR_Phase2_Validation_Guide.md`

## References

- Main tracker: `docs/SAQR_Phase_1_Phase_2_Tracker.md`
- Phase 2 checklist: `docs/checklists/SAQR_Phase2_Execution_Checklist.md`
- Multi-entity domain model: `docs/SAQR_Phase2_Multi_Entity_Domain_Model.md`
- Entity scoping model: `docs/SAQR_Phase2_Entity_Scoping_Model.md`
- Entity reporting model: `docs/SAQR_Phase2_Entity_Reporting_Model.md`
- Sovereign topology model: `docs/SAQR_Phase2_Sovereign_Topology_Model.md`
- Sovereign policy model: `docs/SAQR_Phase2_Sovereign_Policy_Model.md`
- Sovereign packaging model: `docs/SAQR_Phase2_Sovereign_Packaging_Model.md`
- Entity roll-up model: `docs/SAQR_Phase2_Entity_Rollup_Model.md`
- Entity hierarchy contract: `docs/contracts/saqr-entity-hierarchy.yaml`
- Entity scoping contract: `docs/contracts/saqr-entity-scoping.yaml`
- Entity isolation contract: `docs/contracts/saqr-entity-isolation.yaml`
