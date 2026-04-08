# SAQR Phase 2 Sovereign Packaging Model

Date: 2026-04-08
Scope: `P2-208`

## Purpose

This document defines the rollout packaging layer for Phase 2 sovereign delivery. It turns the topology and policy contracts into concrete compose overrides, env templates, and Kubernetes overlays without changing the UI.

This increment remains backend-only and preserves all existing UI/UX guardrails.

## What `P2-208` Completes

- Defines the canonical package-profile model for the supported sovereign rollout patterns.
- Adds reference compose overrides for the supported topology patterns.
- Adds reference env templates and Kubernetes overlays for the supported topology patterns.
- Adds a reusable packaging validator and a machine-readable packaging manifest for delivery handoff.

Authoritative artifacts created in this increment:

- `shared/sovereign-packaging.js`
- `shared/sovereign-packaging.test.js`
- `fixtures/phase2-sovereign/packaging/saqr-reference-sovereign-packaging.package.json`
- `tools/phase2-sovereign/validate-sovereign-packaging.js`
- `docs/contracts/saqr-sovereign-packaging.yaml`

## Packaging Layer Summary

Phase 2 now has a full sovereign-delivery chain:

1. Topology defines where SAQR may run.
2. Policy defines what data may stay, move, or be exported.
3. Packaging defines which concrete artifact set delivery should start from.

This matters because delivery teams no longer need to improvise the first rollout shape for each sovereign pattern.

## Supported Package Profiles

| Profile | Target Pattern | Delivery Artifacts |
|---|---|---|
| `single-tenant-sovereign-cloud` | `single_tenant` | compose override, env template, Kubernetes overlay |
| `per-country-sovereign-cloud` | `per_country` | compose override, env template, Kubernetes overlay |
| `per-cluster-entity-ring` | `per_cluster` | compose override, env template, Kubernetes overlay |
| `client-on-premises` | `on_premises` | compose override, env template, Kubernetes overlay |

## Artifact Layout

The repo now contains:

- compose overrides in `infra/docker-compose.*.yml`
- sovereign env templates in `infra/env/overlays/*.env.template`
- Kubernetes overlays in `infra/k8s/overlays/*`

These artifacts sit on top of the Phase 1 base deployment package:

- `infra/docker-compose.production.yml`
- `infra/k8s/base/*`

That means delivery can start from one shared baseline and then apply the appropriate sovereign rollout profile instead of forking the entire platform package.

## Component Packaging Position

The reference packaging model now binds all Phase 2 platform components:

- `shield-ui`
- `api`
- `workflow-engine`
- `sentinel-scrapers`
- `cv-watchman`
- `nlp-interpreter`
- `evidence-vault`

One important truth is explicit in this increment:

- `workflow-engine` is packaged as an `embedded_module`, not as a standalone runtime service yet

That keeps the packaging honest. We are not pretending a separate workflow runtime daemon exists before it actually does.

## Current Repo Truth After This Increment

- The repo now has concrete rollout artifacts for the four supported sovereign patterns.
- Delivery can select a starting package profile without inventing new compose or overlay structures from scratch.
- The sovereign rollout package now reflects both topology and policy assumptions.
- No UI or runtime presentation behavior was changed in this increment.

## Validation Path

Commands available after this increment:

- `npm run phase2:sovereign:packaging:test`
- `npm run phase2:sovereign:packaging:validate`

Recommended delivery validation commands:

- `docker compose -f infra/docker-compose.production.yml -f infra/docker-compose.single-tenant-sovereign-cloud.yml config`
- `docker compose -f infra/docker-compose.production.yml -f infra/docker-compose.per-country-sovereign-cloud.yml config`
- `docker compose -f infra/docker-compose.production.yml -f infra/docker-compose.per-cluster-entity-ring.yml config`
- `docker compose -f infra/docker-compose.production.yml -f infra/docker-compose.client-on-premises.yml config`

## Scope Boundary

This increment does **not** yet implement:

- client-specific secrets and registry coordinates
- final infrastructure-as-code for target client environments
- country-specific storage classes or node-pool selection

Those remain delivery-owned post-handoff tasks, not additional repo-scope Phase 2 build work.

## Delivery-Team Interpretation

Delivery teams should treat this model as the canonical answer for:

- which rollout artifact set maps to which sovereign topology
- what default policy hints must travel with that rollout
- which components are still containerized services versus embedded modules

The blunt rule is: start from the matching package profile, then tailor for the client. Do not invent a new rollout shape first.

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
- Sovereign topology model: `docs/SAQR_Phase2_Sovereign_Topology_Model.md`
- Sovereign policy model: `docs/SAQR_Phase2_Sovereign_Policy_Model.md`
- Deployment blueprint contract: `docs/contracts/saqr-deployment-blueprint.yaml`
- Sovereign topology contract: `docs/contracts/saqr-sovereign-topology.yaml`
- Sovereign policy contract: `docs/contracts/saqr-sovereign-policy.yaml`
- Sovereign packaging contract: `docs/contracts/saqr-sovereign-packaging.yaml`
