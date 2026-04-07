# SAQR Phase 2 UI Approval Gate

Date: 2026-04-07
Scope: `P2-109`

Use this checklist only if a future Phase 2 workflow change needs to touch a tracked UI baseline file.

## Request Record

- [ ] Change request title is recorded.
- [ ] Business reason is recorded.
- [ ] Backend-only and API-only alternatives were evaluated and documented.
- [ ] The reason those non-UI paths are insufficient is recorded.

## Proposed Change Scope

- [ ] Exact tracked files to be touched are listed.
- [ ] Each file is classified as `Tier 1` or `Tier 2` according to `docs/SAQR_Phase2_UI_Safe_Integration_Plan.md`.
- [ ] Expected visible impact is described in one short paragraph.
- [ ] The proposal confirms whether demo runtime behavior changes.
- [ ] The proposal confirms whether production-ready runtime behavior changes.

## Review Evidence

- [ ] Before screenshots are captured.
- [ ] After screenshots or approved wireframes are captured.
- [ ] Demo runtime review evidence is attached.
- [ ] Production-ready runtime review evidence is attached.
- [ ] Workflow-specific review covers existing surfaces only, unless separate approval says otherwise.

## Guardrail Checks

- [ ] `npm --prefix apps/shield-ui run ui:baseline:check` passed before the change.
- [ ] `npm --prefix apps/shield-ui run ui:baseline:check` passed after implementation review.
- [ ] Any baseline refresh request is explicitly justified.
- [ ] No baseline refresh was performed before written approval.

## Approval Record

- [ ] Written approval exists for the exact scope being changed.
- [ ] The approval names the touched tracked files.
- [ ] The approval confirms the change is minimal and exception-based.
- [ ] The approval confirms whether `apps/shield-ui/ui-baseline.manifest.json` may be refreshed.

## Closeout

- [ ] Implementation matches the approved scope.
- [ ] No unapproved tracked UI files were changed.
- [ ] If a baseline refresh was approved, it was executed only after final visual review.
- [ ] Tracker, docs, and delivery notes were updated to reflect the approved UI exception.
