# SAQR Phase 2 Component and Dependency Matrix

Date: 2026-04-08
Scope: Phase 2 architecture reference for delivery teams

## Component Matrix

| Component | Implementation Shape | Primary Inputs | Primary Outputs | External Dependencies |
|---|---|---|---|---|
| `services/workflow-engine/src/runtime-core.js` | Embedded Node module | Published workflow definitions, normalized events, actor-directory responses | Workflow instances, assignment state, approval sessions, SLA state | Delivery-owned persistence and orchestration wiring later |
| `services/workflow-engine/src/governance.js` | Embedded Node module | Workflow definitions, change requests, approval records | Drafts, published versions, rollback versions, governance history | Delivery-owned persistence later |
| `services/workflow-engine/src/audit-ledger.js` | Embedded Node module | Runtime audit entries, governance history | Combined audit views, decision history, evidence links | Delivery-owned persistence later |
| `apps/api/src/workflow-contract-service.js` | In-process API seam | Bundled workflow definitions, workflow engine modules | Definition listing, validation, event match/start, audit views | Future Fastify route mounting, live authz, persistence |
| `shared/entity-hierarchy.js` | Shared library | Hierarchy definition fixture or delivery-supplied hierarchy document | Lineage-aware hierarchy catalog | Delivery-owned source of org metadata later |
| `shared/entity-scoping.js` | Shared library | Hierarchy catalog, principal grant model | Scope access decisions, accessible-node listing | Delivery-owned principal and role source later |
| `shared/entity-isolation.js` | Shared library | Hierarchy catalog, scoping catalog, isolation policy | Partition envelope, read/write boundary decision | Delivery-owned runtime and storage partitioning later |
| `shared/entity-rollup.js` | Shared library | Hierarchy catalog, control assignments, assessments | Effective control states, node summaries, portfolio roll-up | Delivery-owned assessment persistence later |
| `shared/entity-reporting.js` | Shared library | Reporting definitions, roll-up results, isolation checks | Executive and entity report views | Delivery-owned reporting exposure later |
| `shared/sovereign-topology.js` | Shared library | Topology definition | Component placement and topology profile | Delivery-owned target infrastructure |
| `shared/sovereign-policy.js` | Shared library | Topology catalog, sovereign policy definition | Residency and movement decisions | Delivery-owned encryption, export, and ops controls |
| `shared/sovereign-packaging.js` | Shared library | Topology catalog, policy catalog, packaging definition | Package profile resolution for compose/env/k8s | Delivery-owned client-specific overlays and secrets |
| `tools/phase2-acceptance/*` | Repo-only acceptance harness | Bundled workflow/entity fixtures | Replay results for workflow and multi-entity behavior | None |
| `tools/ci/run-phase2-quality-gates.js` | Repo-only verification runner | Phase 2 tests, validators, acceptance harness, docker compose | Phase 2 verification result | Docker in CI/local where required |

## Dependency Boundaries by Area

### Workflow Runtime

- depends on published workflow definitions, not ad hoc UI state
- depends on an actor-directory provider, but the repo ships an in-memory reference implementation
- remains in-process today; delivery owns durable storage and HTTP mounting

### Multi-Entity

- hierarchy is the canonical source for lineage
- scoping depends on hierarchy
- isolation depends on hierarchy plus scoping
- roll-up depends on hierarchy and control models
- reporting depends on hierarchy, scoping, isolation, and roll-up

### Sovereign Delivery

- topology defines placement model
- policy constrains data movement and encryption boundary
- packaging binds topology plus policy into deployable profile choices

## Operational Signals

| Area | Primary Validation Signal |
|---|---|
| Workflow DSL and runtime | `npm run phase2:workflow:test`, `npm run phase2:workflow:engine:test`, `npm run phase2:workflow:validate` |
| Multi-entity stack | `npm run phase2:entity:test` plus entity validators |
| Sovereign stack | `npm run phase2:sovereign:test`, `npm run phase2:sovereign:policy:test`, `npm run phase2:sovereign:packaging:test` plus validators |
| Acceptance layer | `npm run phase2:acceptance`, `npm run phase2:acceptance:test` |
| UI guardrail | `npm --prefix apps/shield-ui run ui:baseline:check` |
| Delivery packaging | `npm run phase2:quality` sovereign compose overlay gate |

## Delivery Notes

- The workflow engine should not be deployed as a standalone service until delivery intentionally creates that boundary.
- Cross-entity operational reads are controlled; they are not a blanket permission model.
- Reporting runs on an aggregation-plane model, not by mutating entity partitions.
- Sovereign package profiles are starting points, not final client environment IaC.
