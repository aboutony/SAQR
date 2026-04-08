# SAQR Phase 2 Contract Index

Date: 2026-04-08
Scope: Phase 2 contract-set reference

## Purpose

This index consolidates the authoritative Phase 2 contracts so the delivery team can find the backend source of truth without hunting through individual phase notes.

## Workflow Contracts

| Artifact | Purpose |
|---|---|
| `docs/contracts/saqr-workflow-domain.yaml` | Canonical workflow runtime concepts, approvals, SLAs, and audit vocabulary |
| `docs/contracts/saqr-workflow-events.yaml` | Normalized inbound event contract |
| `docs/contracts/saqr-workflow-dsl.yaml` | Workflow authoring grammar and validation rules |
| `docs/contracts/saqr-workflow-api.openapi.yaml` | Workflow API surface published for delivery wiring |
| `docs/contracts/saqr-workflow-fixtures.yaml` | Workflow request and response fixture pack |

## Multi-Entity Contracts

| Artifact | Purpose |
|---|---|
| `docs/contracts/saqr-entity-hierarchy.yaml` | Hierarchy and lineage contract |
| `docs/contracts/saqr-entity-scoping.yaml` | Principal grants and scope-access contract |
| `docs/contracts/saqr-entity-isolation.yaml` | Partition and cross-entity boundary contract |
| `docs/contracts/saqr-entity-rollup.yaml` | Inherited-control aggregation contract |
| `docs/contracts/saqr-entity-reporting.yaml` | Executive and portfolio reporting contract |

## Sovereign Contracts

| Artifact | Purpose |
|---|---|
| `docs/contracts/saqr-sovereign-topology.yaml` | Supported deployment topology patterns |
| `docs/contracts/saqr-sovereign-policy.yaml` | Residency, encryption boundary, and movement policy |
| `docs/contracts/saqr-sovereign-packaging.yaml` | Package-profile and rollout artifact contract |

## Validation Contracts

| Artifact | Purpose |
|---|---|
| `docs/contracts/saqr-phase2-acceptance-fixtures.yaml` | Phase 2 acceptance-fixture manifest and replay expectations |
| `docs/contracts/saqr-phase2-verification-pipeline.yaml` | Phase 2 quality-gate and regression pipeline definition |

## Delivery Use

- Use this index as the entrypoint when wiring HTTP routes, persistence, identity, reporting, or sovereign rollout behavior.
- Treat the listed artifacts as the contract layer. Narrative phase notes should explain them, not override them.
- Pair this contract index with `docs/handoff/SAQR_Phase2_Handoff_Summary.md` and `docs/handoff/SAQR_Phase2_Validation_Guide.md` during final delivery handoff.
