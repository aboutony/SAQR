# SAQR Phase 2 Workflow DSL and Validation

Date: 2026-04-07
Scope: `P2-103`, `P2-105`, `P2-106`, and `P2-107`

## Purpose

This document defines the current Phase 2 workflow-definition DSL posture for SAQR and the validation rules that now protect the approval-routing model implemented in the repo.

This increment remains backend-first. It does not authorize any UI changes.

## Authoritative Artifacts

- `docs/contracts/saqr-workflow-dsl.yaml`
- `docs/contracts/saqr-workflow-domain.yaml`
- `fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json`
- `fixtures/phase2-workflow/workflows/visual-branch-remediation.workflow.json`
- `fixtures/phase2-workflow/workflows/cross-authority-committee-review.workflow.json`
- `tools/phase2-workflow/validate-workflow-definition.js`
- `tools/phase2-workflow/validator.js`
- `tools/phase2-workflow/validator.test.js`

## Canonical Authoring Format

Phase 2 DSL version 1 still uses JSON as the canonical authoring format for concrete workflow-definition files.

Why this remains the right choice in the current increment:

- It keeps validation dependency-free in the free-toolchain path.
- It allows deterministic local validation with Node only.
- It stays compatible with a future no-code export/import path later in Phase 2.

## What Changed in `P2-105`

The DSL now formally describes approval-routing semantics instead of only generic approval steps.

New canonical grammar elements:

- selector grammar for `user`, `role`, and `queue`
- canonical `assignmentRule.selectors`
- approval-policy `delegateSelectors`
- approval-policy `committeeSelectors`
- approval-policy `quorumMode`
- approval-policy `rejectionMode`
- approval-policy `makerCheckerScope`

New `P2-106` grammar elements already consumed by the runtime:

- SLA reminder intervals
- SLA pause-state rules
- escalation-policy trigger conditions for `sla_warning` and `sla_breach`

New `P2-107` governance controls already consumed by the service layer:

- `publishControls.changeSummary`
- `publishControls.approvalRecordRequired`
- `publishControls.rollbackOfVersion`
- `publishControls.publishedAt`

Legacy single-target assignment fields such as `actorId`, `role`, and `queue` remain validator-compatible for controlled backward compatibility, but `selectors` is now the preferred grammar.

## Validation Rules Now Enforced

### Document and Flow Integrity

- top-level required fields must exist
- `schemaVersion` must equal `1`
- `workflowKey` must use the stable slug pattern
- step order values must be unique and contiguous
- `entryStepKey` must exist and point to the step with order `1`
- transitions must target a real step or `null`
- all steps must be reachable from the entry step

### Selector Grammar

- selectors must be objects
- selector type must be one of `user`, `role`, or `queue`
- selector value must be a non-empty string
- assignment, approver, delegate, and committee selectors all pass through this same rule set

### Approval Policy Integrity

- approval policies must declare `mode`, `minimumApprovals`, and `approverSelectors`
- `maker_checker` policies must include `makerCheckerScope` or compatibility-era `segregationOfDuties`
- only `fixed` quorum is accepted in the current implementation path
- `rejectionMode` must be one of the contract-approved values

### Step-to-Action Compatibility

The validator continues to reject mismatched combinations such as:

- `approve` without `request_approval`
- `notify` without `emit_notification`
- `wait_timer` without `pause_until_deadline`
- `invoke_webhook` without `invoke_delivery_webhook`

## Bundled Example Workflows

### Regulatory Drift Review

Demonstrates:

- NLP and Sentinel triggers
- queue-based triage assignment
- maker-checker approval
- explicit committee selectors for escalation
- remediation and verification loop

### Visual Branch Remediation

Demonstrates:

- CV and manual launch triggers
- queue assignment
- delivery webhook invocation
- timer waiting state
- verification loop

### Cross Authority Committee Review

Demonstrates:

- fixed-quorum `parallel_committee` approval
- committee selectors
- committee rejection by quorum impossibility
- manual launch path for deterministic testing

## Validation Commands

Validate the bundled workflow examples:

```powershell
npm run phase2:workflow:validate
```

Run the validator tests:

```powershell
npm run phase2:workflow:test
```

Validate one workflow definition directly:

```powershell
node tools/phase2-workflow/validate-workflow-definition.js fixtures/phase2-workflow/workflows/cross-authority-committee-review.workflow.json
```

## Scope Boundary Preserved

- No UI or UX changes were introduced.
- The Phase 1 demo environment remains untouched.
- The DSL and validator are interface-ready, not persistence-backed.
- The current runtime now supports deterministic SLA monitoring against this grammar.
- The governance layer now consumes `publishControls` for versioning and publication control.
- Workflow APIs remain later work.

## Next Recommended Step

The next logical Phase 2 task is `P2-108`: evidence-linked workflow audit history.

## References

- Workflow foundations: `docs/SAQR_Phase2_Workflow_Foundations.md`
- Workflow execution engine: `docs/SAQR_Phase2_Workflow_Execution_Engine.md`
- Approval routing engine: `docs/SAQR_Phase2_Approval_Routing_Engine.md`
- SLA automation layer: `docs/SAQR_Phase2_SLA_Automation.md`
- Workflow governance: `docs/SAQR_Phase2_Workflow_Governance.md`
- Workflow domain contract: `docs/contracts/saqr-workflow-domain.yaml`
- Workflow DSL contract: `docs/contracts/saqr-workflow-dsl.yaml`
