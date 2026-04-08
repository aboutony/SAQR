# SAQR Phase 2 Sovereign Topology Model

Date: 2026-04-08
Scope: `P2-206`

## Purpose

This document defines the supported deployment topology patterns for the Phase 2 sovereign model. It turns the earlier multi-entity and deployment foundations into explicit, machine-checkable topology choices for delivery teams without changing the UI.

This increment remains backend-only and preserves all existing UI/UX guardrails.

## What `P2-206` Completes

- Defines the canonical topology-pattern model for `single_tenant`, `per_country`, `per_cluster`, and `on_premises`.
- Defines how SAQR platform components are classified as shared or isolated inside each topology boundary.
- Adds a reusable topology-validation module, reference sovereign topology fixture, and CLI validator.
- Documents delivery assumptions for topology planning before residency policy and packaging extensions are added.

Authoritative artifacts created in this increment:

- `shared/sovereign-topology.js`
- `shared/sovereign-topology.test.js`
- `fixtures/phase2-sovereign/topologies/saqr-reference-sovereign-topology.topology.json`
- `tools/phase2-sovereign/validate-sovereign-topology.js`
- `docs/contracts/saqr-sovereign-topology.yaml`

## Topology Layer Summary

Phase 2 now has a clear sequence for deployment architecture:

1. Hierarchy defines the entity boundaries.
2. Scoping defines who can access which scopes.
3. Isolation defines what runtime boundary still applies.
4. Reporting defines what aggregated read-only views are allowed.
5. Sovereign topology defines how SAQR is physically or logically placed for delivery.

This matters because deployment pattern is not the same thing as authorization, and it is not the same thing as residency policy. We are now defining the placement patterns only.

## Supported Topology Patterns

| Pattern | Meaning |
|---|---|
| `single_tenant` | One tenant-dedicated sovereign-cloud stack for one client environment |
| `per_country` | One sovereign-cloud stack per country boundary |
| `per_cluster` | One controlled cluster ring per isolated entity or jurisdiction ring |
| `on_premises` | Full client-managed on-prem or air-gapped deployment |

## Component Placement Model

Each topology classifies the platform components as either:

- shared within the active topology boundary
- isolated within the active topology boundary

The reference model now covers these platform components:

- `shield-ui`
- `api`
- `workflow-engine`
- `sentinel-scrapers`
- `cv-watchman`
- `nlp-interpreter`
- `evidence-vault`

This gives delivery teams a canonical answer to a blunt question: which parts of SAQR may stay shared inside a topology, and which parts should be split more aggressively.

## Current Reference Position

The reference topology model expresses these defaults:

- `single_tenant`: entire stack shared within one tenant-dedicated sovereign boundary
- `per_country`: presentation and control-plane services may stay shared within one country stack, while evidence and worker services are isolated per country
- `per_cluster`: UI and API may stay shared inside one cluster ring, while workflow and worker/data services can be isolated per cluster
- `on_premises`: entire stack can operate inside a client-owned premises boundary

This is intentionally practical. It gives delivery teams a real starting matrix without pretending the residency policy work is already done.

## External Dependency Assumptions

The reference model assumes these external dependencies remain present across topology patterns:

- `postgres`
- `kafka`
- `identity-provider`
- `vms-gateway`
- `ingress-gateway`

This does **not** define the final client-specific manifest strategy for those dependencies. That remains delivery-owned after the reference packaging model.

## Current Repo Truth After This Increment

- The repo now has a canonical, test-backed sovereign topology matrix instead of only narrative deployment notes.
- The workflow engine is included in the topology surface as a Phase 2 deployable component.
- The model is still contract-first and fixture-backed. It does not claim final client architecture or legal compliance yet.
- No UI or runtime presentation behavior was changed in this increment.

## Validation Path

Commands available after this increment:

- `npm run phase2:sovereign:validate`
- `npm run phase2:sovereign:test`

The test coverage validates:

- reference topology-model validity
- correct placement resolution for per-country, per-cluster, and on-prem topologies
- rejection of invalid topology patterns and incompatible placement declarations

## Scope Boundary

This increment does **not** yet implement final client cluster manifests or infrastructure code.

## Delivery-Team Interpretation

Delivery teams should treat this model as the canonical answer for:

- which topology patterns SAQR officially supports in Phase 2
- what each topology boundary means
- which platform services may remain shared within a topology
- which platform services should be isolated more aggressively in country or cluster-based patterns

The blunt rule is: do not invent a fifth topology until this contract is updated.

## Phase 2 Closeout

This workstream now closes through the Phase 2 handoff package:

- `docs/handoff/README.md`
- `docs/handoff/SAQR_Phase2_Handoff_Summary.md`
- `docs/handoff/SAQR_Phase2_Validation_Guide.md`

## References

- Main tracker: `docs/SAQR_Phase_1_Phase_2_Tracker.md`
- Phase 2 roadmap: `docs/SAQR_Phase2_Roadmap.md`
- Phase 2 checklist: `docs/checklists/SAQR_Phase2_Execution_Checklist.md`
- Phase 1 deployment blueprint: `docs/SAQR_Phase1_Deployment_Blueprint.md`
- Multi-entity domain model: `docs/SAQR_Phase2_Multi_Entity_Domain_Model.md`
- Entity isolation model: `docs/SAQR_Phase2_Entity_Isolation_Model.md`
- Entity reporting model: `docs/SAQR_Phase2_Entity_Reporting_Model.md`
- Deployment blueprint contract: `docs/contracts/saqr-deployment-blueprint.yaml`
- Sovereign topology contract: `docs/contracts/saqr-sovereign-topology.yaml`
- Sovereign policy model: `docs/SAQR_Phase2_Sovereign_Policy_Model.md`
- Sovereign policy contract: `docs/contracts/saqr-sovereign-policy.yaml`
- Sovereign packaging model: `docs/SAQR_Phase2_Sovereign_Packaging_Model.md`
- Sovereign packaging contract: `docs/contracts/saqr-sovereign-packaging.yaml`
