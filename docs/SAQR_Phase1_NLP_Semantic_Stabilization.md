# SAQR Phase 1 NLP Semantic Stabilization

Date: 2026-04-07
Scope: `P1-402`

## Objective

Stabilize the rule-based semantic extraction layer so the known failing semantic tests are cleared and the downstream drift-detection bridge receives cleaner, more reliable constraint payloads.

## Completed Result

`P1-402` is now complete.

## What Changed

Primary implementation:

- `services/nlp-interpreter/src/semantic-extractor.js`

Regression coverage:

- `services/nlp-interpreter/src/semantic.test.js`

### Fixes applied

- broadened financial-cap extraction to support real regulatory phrasing such as `shall not exceed SAR ...`
- fixed penalty-amount extraction for phrases like `penalty of up to SAR ...`
- preserved text-order stability by sorting extracted constraints by source position
- removed duplicate overlapping constraint hits by deduplicating on normalized context
- improved context extraction so each constraint carries the surrounding sentence instead of a brittle substring slice
- improved unit inference so thresholds like `14pt` are returned as `pt` instead of a generic currency default

## Verification

Command executed:

- `npm test` in `services/nlp-interpreter`

Result:

- `35/35` tests passed

Key corrected behaviors:

- `extractConstraints('Maximum fee shall not exceed SAR 500,000')` now returns a single `financialCap` constraint with value `500000`
- `extractConstraints('penalty of up to SAR 2,000,000 for repeated offenses')` now returns a `penaltyAmount` constraint with value `2000000`
- `extractConstraints('Consumer disclosures must use font size minimum 14pt')` now returns a `minimumThreshold` constraint with unit `pt`

## Impact

This closes the previously known semantic-test instability called out in earlier Phase 1 audits.

Current NLP status after this work:

- config/runtime hardening completed
- semantic extraction regression suite fully passing
- rule-based Phase A extractor remains in place
- future BERT/provider replacement path remains open without interface changes

## Next Recommended Step

Move to `P1-303`:

- observability
- structured operational logging
- audit/event logging
- ops runbook and failure visibility
