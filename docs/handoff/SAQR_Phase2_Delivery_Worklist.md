# SAQR Phase 2 Delivery Worklist

Date: 2026-04-08
Scope: Delivery-owned work after Phase 2 repo handoff

## Workflow Persistence and APIs

- Choose and provision the durable store for workflow definitions, runtime instances, approval state, SLA state, and audit projections.
- Mount the workflow API surface in the delivery-owned HTTP layer using the published contract package.
- Preserve idempotency, audit immutability, and workflow-version history semantics when adding persistence.

## Identity and Actor Resolution

- Wire a real actor directory and IdP to the workflow actor-resolution contract.
- Map real users, roles, queues, and explicit delegates into the selector model.
- Validate maker-checker, delegated approval, and committee behavior with real identity data before pilot claims.

## Notification and Tasking Integrations

- Wire delivery-owned notification channels, escalation targets, and remediation-task dispatch.
- Preserve the workflow step outcomes and audit semantics even when external tasking providers differ by client.
- Add retry, failure handling, and operational monitoring for external notification or tasking delivery.

## Multi-Entity Data and Authorization

- Load the client’s real group, entity, business-unit, site, and silo structure into the canonical hierarchy model.
- Map real principals and grants into the entity-scoping contract.
- Validate cross-entity read paths, reporting-plane behavior, and partition-local mutation rules in the target environment.

## Sovereign Topology and Packaging

- Select the correct sovereign package profile for the client target topology.
- Replace placeholders, secrets, ingress values, registry values, and cluster specifics in the chosen overlay set.
- Validate that delivery-side infrastructure controls actually match the declared topology and policy assumptions.

## Phase 1 Baseline Dependencies Still Required

- Provision shadow PostgreSQL.
- Provision Kafka and Kafka Connect / Debezium where CDC remains in client scope.
- Provision live VMS connectivity where CV remains in client scope.
- Preserve the frozen UI baseline and keep the demo environment separate from the implementation environment.

## Operational Readiness

- Run the full Phase 1 and Phase 2 verification path after delivery wiring.
- Capture signoff that workflow, entity, sovereign, and Phase 1 baseline behavior all pass in the target environment.
- Perform pilot validation before any client production-cutover claim is made.

## Explicitly Out Of Scope For This Repo Handoff

- final client-specific infrastructure-as-code
- approved UI redesign or workflow administration UI
- proof of client production readiness without delivery-environment validation
