# SAQR Phase 2 Workflow Operations Runbook

Date: 2026-04-08
Scope: Phase 2 workflow runtime, governance, and audit operations

## Purpose

This runbook gives the delivery team the minimum safe operating pattern for the Phase 2 workflow layer as it exists in the repository today.

## Current Implementation Truth

- The workflow engine is an embedded backend module.
- The API seam is implemented, but final HTTP route mounting is still delivery-owned.
- Governance, runtime, audit ledger, and acceptance fixtures are all real and test-backed.
- UI workflow administration is still out of scope unless separately approved.

## Before Delivery Wiring

1. Run `npm run phase2:quality`.
2. Confirm the workflow definitions intended for delivery still pass `npm run phase2:workflow:validate`.
3. Confirm the delivery-side actor directory design can satisfy:
   - selector resolution
   - delegate resolution
   - role membership checks
4. Decide where delivery will persist:
   - workflow definitions
   - workflow versions and governance history
   - workflow instances and active step state
   - audit ledger projection inputs

## Safe Workflow Change Sequence

1. Validate the candidate definition against the DSL.
2. Create a draft version from the current published version.
3. Record a meaningful change summary.
4. Publish only with an approval record when the workflow demands it.
5. Run the Phase 2 acceptance harness after publishing-related changes.
6. If a bad version slips through, rollback by creating a new published rollback version. Do not mutate history in place.

## Recommended Verification Commands

- `npm run phase2:workflow:test`
- `npm run phase2:workflow:engine:test`
- `npm run phase2:workflow:validate`
- `npm run phase2:acceptance -- --scenario workflow-maker-checker --json`
- `npm run phase2:acceptance -- --scenario workflow-committee --json`

## What Delivery Should Watch

### Definition and Governance Health

- unpublished drafts accumulating with no clear owner
- missing approval records for approval-gated workflows
- repeated rollback creation on the same workflow without root-cause analysis

### Runtime Health

- events matching zero workflows unexpectedly
- unexpected duplicate instance starts for the same idempotency key
- approval rounds that never resolve because actor resolution is incomplete
- SLA escalations firing because delivery has not wired assignment ownership correctly

### Audit Health

- runtime audit history present but governance history missing
- evidence links present in workflow actions but absent from decision history
- audit views differing between runtime state and projected ledger outputs

## Common Failure Patterns

### Definition Validation Failure

Expected impact:

- workflow cannot be accepted into the delivery change path

Actions:

1. Run `npm run phase2:workflow:validate`.
2. Check selector grammar, step references, and approval policy fields.
3. Do not bypass the validator with manual runtime injection.

### Actor Resolution Failure

Expected impact:

- assignment or approval steps open with the wrong assignees or with no valid assignees

Actions:

1. Verify the delivery-owned actor directory satisfies the selector contract.
2. Reproduce with the bundled acceptance scenarios before blaming runtime logic.
3. Confirm role and queue mappings are entity-aware where delivery requires that behavior.

### Approval Deadlock or Unexpected Rejection

Expected impact:

- maker-checker or committee steps do not resolve as expected

Actions:

1. Inspect the approval policy mode and minimum approvals.
2. Confirm the origin actor is not also acting as the approver when maker-checker is enabled.
3. Confirm delegate resolution is explicit and allowed by policy.

### SLA Noise or Premature Escalation

Expected impact:

- warnings or breach transitions appear too early

Actions:

1. Inspect the SLA policy values on the active step.
2. Check whether the runtime state should be pause-aware for that step.
3. Confirm delivery has not altered the clock or scheduling semantics around evaluation.

## Delivery Notes

- Treat the bundled workflow definitions as reference contracts, not as final client-configured workflow inventory.
- Preserve audit immutability. Delivery should extend storage and exposure, not rewrite ledger semantics.
- Do not mount workflow HTTP routes publicly until delivery has aligned authz with the entity and isolation model.
