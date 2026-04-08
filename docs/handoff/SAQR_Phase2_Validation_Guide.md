# SAQR Phase 2 Validation Guide

Date: 2026-04-08
Scope: Final validation path for Phase 2 handoff

## Command Sequence

1. `npm run phase1:bootstrap`
   Expected signal: script completes with `workspace bootstrap complete`

2. `npm run phase1:handoff:verify`
   Expected signal: script prints a `PASS` line confirming the Phase 1 handoff manifest and referenced files are valid

3. `npm run phase2:handoff:verify`
   Expected signal: script prints a `PASS` line confirming the Phase 2 handoff manifest and referenced files are valid

4. `npm run phase2:acceptance`
   Expected signal: all registered Phase 2 scenarios return `"pass": true`

5. `npm run phase2:quality`
   Expected signal: all Phase 2 quality gates report `PASSED`

6. `npm run phase1:release:verify`
   Expected signal: script completes with `release-readiness verification complete`

7. `npm --prefix apps/shield-ui run ui:baseline:check`
   Expected signal: UI baseline check passes for all tracked files

## Manual Review Checks

- Read `docs/handoff/SAQR_Phase2_Handoff_Summary.md` and confirm the readiness language remains blunt and truthful.
- Confirm the workflow engine is still treated as an embedded module in the docs and packaging model.
- Confirm the current UI baseline remains unchanged and no unapproved tracked UI files moved.
- Confirm the sovereign package profiles still match the documented topology and policy contracts.
- Confirm the demo environment remains separate from the implementation-ready path.

## Signoff Flow

1. Repo package signoff:
   Confirm both Phase 1 and Phase 2 handoff verification, acceptance, and quality paths pass.

2. Delivery-environment signoff:
   Confirm workflow persistence, route mounting, actor directory, client hierarchy data, and sovereign overlay tailoring are complete.

3. Pilot-readiness signoff:
   Confirm target-environment validation is complete before any client production-cutover claim is made.
