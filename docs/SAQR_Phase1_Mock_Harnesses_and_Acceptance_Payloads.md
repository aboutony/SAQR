# SAQR Phase 1: Mock Harnesses and Acceptance Payloads

Date: 2026-04-07
Scope: `P1-503`

## Outcome

Phase 1 now includes a delivery-team acceptance kit built from free tooling only. It provides replayable fixture payloads and small Node harnesses that exercise the current production-ready seams without requiring a real DB, Kafka, VMS, or external authority environment.

## Artifacts

- Fixture manifest: `fixtures/phase1-acceptance/manifest.json`
- CDC acceptance payloads: `fixtures/phase1-acceptance/cdc/cdc-replay.json`
- NLP acceptance payloads: `fixtures/phase1-acceptance/nlp/nlp-replay.json`
- Sentinel acceptance payloads: `fixtures/phase1-acceptance/sentinel/sentinel-replay.json`
- CV acceptance payloads: `fixtures/phase1-acceptance/cv/cv-replay.json`
- Harness module: `tools/phase1-acceptance/harness.js`
- Harness CLI: `tools/phase1-acceptance/run-phase1-acceptance.js`
- Machine-readable contract: `docs/contracts/saqr-acceptance-fixtures.yaml`

## What Was Added

1. A fixture manifest that registers all replay scenarios for Phase 1 delivery testing.
2. Acceptance payloads for CDC, NLP, Sentinel, and CV provider paths.
3. A runnable harness that replays those fixtures through the actual Phase 1 orchestration and adapter seams.
4. A lightweight test file so the acceptance pack itself can be verified in CI or during delivery handoff.

## Delivery-Team Guidance

- Run `node tools/phase1-acceptance/run-phase1-acceptance.js --scenario all --json` from the repo root to replay the full Phase 1 acceptance batch.
- Run `node --test tools/phase1-acceptance/harness.test.js` to confirm the harness remains valid after delivery-side changes.
- Preserve the fixture shapes when substituting real connectors so the acceptance checks continue to prove contract compatibility.
- Treat this kit as a pre-integration gate, not as a replacement for live-environment SIT/UAT.

## Scope Notes

- No UI or UX files were changed in this phase.
- The fixtures are intentionally infrastructure-free and safe to run on a delivery workstation with no client connectivity.
- The NLP replay fixture is aligned to the platform's current rule-based drift engine, which classifies this replay as `added` plus `removed` drift rather than semantic `parameter_change`.
