# SAQR

SAQR is a read-only compliance interception platform with two parallel tracks in this repository:

- the preserved demo environment for client demos
- the production-ready Phase 1 handoff package for the delivery team

## Current Status

Phase 1 is complete for delivery-team handoff.

Phase 1 is not a direct client production-cutover package. Real client prerequisites and delivery-owned wiring are still required.

## Start Here

- Final Phase 1 handoff package: `docs/handoff/README.md`
- Delivery documentation index: `docs/README.md`
- Phase tracker: `docs/SAQR_Phase_1_Phase_2_Tracker.md`

## Repo Truths

- The demo environment remains preserved and separate.
- The UI/UX is frozen and must not be changed without explicit approval.
- External prerequisites are not provisioned in this repo.
- Current live regulatory-source implementation is centered on SAMA and SDAIA.
- NLP and CV are interface-ready and test-backed, but still require target-environment wiring and pilot validation.

## Validation Commands

```bash
npm run phase1:bootstrap
npm run phase1:handoff:verify
npm run phase1:quality
npm run phase1:release:verify -- --build-containers
```

## Delivery Scope

This repository includes the production-ready contracts, packaging, validation path, and handoff documentation for:

- Shield UI
- SAQR API
- Evidence Vault
- Sentinel Scrapers
- NLP Interpreter
- CV Watchman
- CDC connector artifacts

Phase 2 items are intentionally excluded from the Phase 1 handoff package.
