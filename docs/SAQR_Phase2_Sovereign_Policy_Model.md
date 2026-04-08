# SAQR Phase 2 Sovereign Policy Model

Date: 2026-04-08
Scope: `P2-207`

## Purpose

This document defines the sovereign policy layer for Phase 2. It turns the supported topology patterns into explicit rules for residency, encryption boundary, and cross-border data movement without changing the UI.

This increment remains backend-only and preserves all existing UI/UX guardrails.

## What `P2-207` Completes

- Defines the canonical policy model for residency, encryption-boundary, and cross-border movement rules.
- Adds a reusable backend policy module, reference sovereign policy fixture, and CLI validator.
- Defines policy resolution by topology pattern and protected data class.
- Defines a machine-checkable cross-border movement evaluation path for delivery teams.

Authoritative artifacts created in this increment:

- `shared/sovereign-policy.js`
- `shared/sovereign-policy.test.js`
- `fixtures/phase2-sovereign/policies/saqr-reference-sovereign-policy.policy.json`
- `tools/phase2-sovereign/validate-sovereign-policy.js`
- `docs/contracts/saqr-sovereign-policy.yaml`

## Policy Layer Summary

Phase 2 now separates three different deployment questions:

1. Topology: where the SAQR stack is placed.
2. Policy: what data may stay, move, or be exported across those topology boundaries.
3. Packaging: how delivery turns those rules into actual manifests and environment-specific configuration.

This increment is about the second layer only.

## Protected Data Classes

The reference policy model currently classifies these data classes:

- `workflow_runtime`
- `evidence_records`
- `reporting_aggregates`
- `credential_secrets`

This is intentionally blunt. Delivery teams now have a consistent answer for which SAQR data is most movement-sensitive and how its encryption boundary should be interpreted.

## Core Rule Model

Each policy rule now defines:

- `dataClass`
- `topologyPatterns`
- `residencyRequirement`
- `encryptionBoundary`
- `crossBorderMode`
- `relatedComponents`

The reference model uses these pattern-aligned defaults:

- `single_tenant` => `topology_boundary` + `tenant_managed_kms`
- `per_country` => `country_boundary` + `country_managed_kms`
- `per_cluster` => `topology_boundary` + `cluster_managed_kms`
- `on_premises` => `premises_boundary` + `customer_managed_hsm`

That gives delivery teams a clean baseline before they start client-specific residency tailoring.

## Cross-Border Movement Model

Cross-border handling is now explicit per data class:

- `evidence_records` are prohibited from cross-border movement in the reference policy
- `credential_secrets` are prohibited from cross-border movement in the reference policy
- `workflow_runtime` may require explicit approval depending on topology
- `reporting_aggregates` may use controlled brokered export or metadata-only movement depending on topology

This does not mean the reference model is the final client policy. It means the repo now has an enforceable baseline instead of narrative ambiguity.

## Current Repo Truth After This Increment

- The repo now has a canonical, test-backed sovereign policy contract on top of the topology model.
- Residency and encryption-boundary guidance are now machine-checkable by topology pattern and data class.
- Cross-border movement decisions can now be evaluated headlessly instead of being left to ad hoc delivery interpretation.
- No UI or runtime presentation behavior was changed in this increment.

## Validation Path

Commands available after this increment:

- `npm run phase2:sovereign:policy:test`
- `npm run phase2:sovereign:policy:validate`

The test coverage validates:

- reference sovereign-policy validity
- effective policy resolution for country, cluster, and on-prem patterns
- denial of prohibited cross-border movement
- brokered export handling for reporting aggregates
- approval-gated cross-border workflow movement

## Scope Boundary

This increment does **not** yet implement:

- client-specific KMS wiring
- final registry or secret-manager placement
- infrastructure templates for country-aware rollout variants

Those remain delivery-owned post-handoff tasks, not additional repo-scope Phase 2 build work.

## Delivery-Team Interpretation

Delivery teams should treat this model as the canonical answer for:

- which SAQR data classes are residency-sensitive
- what encryption boundary is expected per topology pattern
- which cross-border movements are prohibited
- which movements require brokered export or explicit approval

The blunt rule is: if a movement is not explicitly allowed by policy, assume it is denied.

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
- Sovereign packaging model: `docs/SAQR_Phase2_Sovereign_Packaging_Model.md`
- Deployment blueprint contract: `docs/contracts/saqr-deployment-blueprint.yaml`
- Sovereign topology contract: `docs/contracts/saqr-sovereign-topology.yaml`
- Sovereign policy contract: `docs/contracts/saqr-sovereign-policy.yaml`
- Sovereign packaging contract: `docs/contracts/saqr-sovereign-packaging.yaml`
