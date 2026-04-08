# SAQR Phase 2 Entity and Sovereign Runbook

Date: 2026-04-08
Scope: Phase 2 multi-entity, reporting, and sovereign rollout operations

## Purpose

This runbook gives the delivery team the minimum safe operating pattern for the Phase 2 multi-entity and sovereign model.

## Current Implementation Truth

- Hierarchy, scoping, isolation, roll-up, and reporting are explicit backend models.
- Sovereign topology, policy, and packaging are explicit backend models.
- The repo includes reference fixtures and validators for each layer.
- Client-specific org data, residency controls, and infrastructure values are still delivery-owned.

## Before Delivery Wiring

1. Run `npm run phase2:quality`.
2. Confirm the intended client org model can map to:
   - `group`
   - `entity`
   - `businessUnit`
   - `site`
   - `silo`
3. Confirm delivery knows which resources remain partition-local and which are reporting-plane only.
4. Select the sovereign package profile that matches the real target topology before editing overlays.

## Recommended Verification Commands

- `npm run phase2:entity:test`
- `npm run phase2:entity:validate`
- `npm run phase2:entity:scope:validate`
- `npm run phase2:entity:isolation:validate`
- `npm run phase2:entity:rollup:validate`
- `npm run phase2:entity:reporting:validate`
- `npm run phase2:sovereign:test`
- `npm run phase2:sovereign:policy:test`
- `npm run phase2:sovereign:packaging:test`
- `npm run phase2:sovereign:validate`
- `npm run phase2:sovereign:policy:validate`
- `npm run phase2:sovereign:packaging:validate`

## Choosing the Right Sovereign Starting Point

Use these package profiles as the default starting points:

| Target Shape | Start Here |
|---|---|
| Single sovereign tenant | `infra/docker-compose.single-tenant-sovereign-cloud.yml` |
| Country-separated cloud rollout | `infra/docker-compose.per-country-sovereign-cloud.yml` |
| Cluster-ring isolation rollout | `infra/docker-compose.per-cluster-entity-ring.yml` |
| Client on-premises rollout | `infra/docker-compose.client-on-premises.yml` |

Do not invent a new rollout pattern first. Start from the closest supported profile and tailor it.

## Operational Rules That Matter Most

### Entity Scope

- resolve scope from the deepest declared node upward
- reject conflicting lineage instead of silently guessing intent

### Isolation

- `same_partition_direct` is the only normal path for workflow and evidence mutation
- `brokered_read_only` is for controlled cross-entity reads
- `aggregate_read_only` is for reporting only

### Reporting

- assessments remain exact to the assessed node
- assignments may inherit
- roll-ups aggregate effective states, not raw assignment counts alone

### Sovereign Control

- if a movement is not explicitly allowed by policy, treat it as denied
- packaging profiles must align to both topology and policy assumptions

## Common Failure Patterns

### Scope Conflict

Expected impact:

- workflows, evidence, or reports resolve against the wrong lineage or fail validation

Actions:

1. Validate the hierarchy fixture or delivery-owned hierarchy document.
2. Re-check the deepest supplied scope field.
3. Reject conflicting caller-supplied lineage instead of “repairing” it heuristically.

### Cross-Entity Access Surprise

Expected impact:

- delivery expects a cross-entity read or write to work, but the model denies it

Actions:

1. Inspect the scoping grant.
2. Inspect the resource isolation policy.
3. Distinguish between a scoping denial and an isolation denial before changing the model.

### Roll-Up Mismatch

Expected impact:

- executive report totals do not match delivery expectations

Actions:

1. Verify whether the control was assigned locally or inherited.
2. Verify whether the assessment is exact to the node being reviewed.
3. Reproduce with the bundled reporting acceptance scenario before changing roll-up logic.

### Sovereign Overlay Mismatch

Expected impact:

- delivery applies the wrong compose or k8s overlay to the chosen deployment target

Actions:

1. Re-check the chosen topology pattern.
2. Validate the sovereign packaging profile.
3. Run compose config validation for the intended overlay.

## Delivery Notes

- Do not collapse multi-entity logic back into ad hoc “tenant” assumptions.
- Do not treat reporting-plane access as permission to mutate entity partitions.
- Do not bypass sovereign policy by hard-coding one client topology into the shared package profiles.
