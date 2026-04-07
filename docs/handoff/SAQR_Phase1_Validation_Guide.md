# SAQR Phase 1 Validation Guide

Date: 2026-04-07
Scope: Final validation path for delivery handoff

## Command Sequence

1. `npm run phase1:bootstrap`
   Expected signal: script completes with `workspace bootstrap complete`

2. `npm run phase1:handoff:verify`
   Expected signal: script prints a `PASS` line confirming the handoff manifest and referenced files are valid

3. `npm run phase1:quality`
   Expected signal: all quality gates report `PASSED`, including the handoff package gate

4. `npm run phase1:release:verify`
   Expected signal: script completes with `release-readiness verification complete`

5. `npm run phase1:release:verify -- --build-containers`
   Expected signal: release-readiness completes and the production-ready images build successfully

6. `npm --prefix apps/shield-ui run ui:baseline:check`
   Expected signal: UI baseline check passes for all tracked files

## Manual Review Checks

- Read `docs/handoff/SAQR_Phase1_Handoff_Summary.md` and confirm the readiness language is still blunt and truthful.
- Confirm `.env.production.example` still uses placeholders only.
- Confirm `infra/docker-compose.production.yml` and `infra/k8s/base/*` still match the documented contracts.
- Confirm the demo environment and the production-ready handoff path remain separate.

## Signoff Flow

1. Repo package signoff:
   Confirm bootstrap, handoff verification, quality gates, and release-readiness all pass.

2. Delivery-environment signoff:
   Confirm target-environment wiring for DB, Kafka, IdP, VMS, and platform prerequisites is complete.

3. Pilot-readiness signoff:
   Confirm real-environment validation has been completed before any client production-cutover claim is made.

