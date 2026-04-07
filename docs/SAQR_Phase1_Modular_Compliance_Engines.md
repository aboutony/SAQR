# SAQR Phase 1 Modular Compliance Engines

Date: 2026-04-07
Scope: `P1-403`

## Objective

Refactor SAQR rule evaluation into modular, delivery-ready service modules so regulatory logic can be extended, tested, and swapped without editing runtime entrypoints.

## Completed Result

`P1-403` is now complete.

## What Was Added

Shared rule-engine primitive:

- `shared/rule-engine.js`

Evidence Vault modular rule engine:

- `services/evidence-vault/src/compliance-engine.js`
- `services/evidence-vault/src/rules/sama-disclosure-rules.js`
- `services/evidence-vault/src/rules/sama-cooling-off-rules.js`
- `services/evidence-vault/src/rules/momah-branch-rules.js`

NLP modular constraint engine:

- `services/nlp-interpreter/src/constraint-engine.js`
- `services/nlp-interpreter/src/rules/constraint-rules.js`
- `services/nlp-interpreter/src/sentinel-bridge.js`

## Delivery-Ready Outcome

### Evidence Vault

CDC compliance evaluation is no longer a single hard-wired switch statement.

It now runs through:

- a reusable rule-engine primitive
- explicit rulesets per regulatory area
- a composed compliance service that can accept new rulesets without rewriting the main evaluator

Current rulesets cover:

- SAMA consumer disclosure font-size rules
- SAMA cooling-off rules
- MOMAH branch-compliance rules

### NLP Interpreter

Constraint-vs-CDC evaluation is no longer embedded as one bridge-local decision block.

It now runs through:

- a dedicated constraint-evaluation service
- separate rulesets for financial caps, minimum thresholds, and time windows
- pluggable field matching and fine-calculation strategies

This makes the NLP bridge easier for the delivery team to extend when they replace demo CDC assumptions with real source data.

## Why This Matters

Before this phase:

- rule evaluation logic was embedded in service files and bridge files
- extending rules meant editing mixed orchestration/business-logic code
- unit testing focused on outcomes but not on modular rule composition

After this phase:

- rule logic is isolated into rule modules
- orchestration and evaluation are separated
- contract-level tests now verify rule-engine composition
- the delivery team has clean extension points for new authorities and policies

## Verification

Syntax checks passed for:

- `shared/rule-engine.js`
- `services/evidence-vault/src/compliance-engine.js`
- `services/nlp-interpreter/src/constraint-engine.js`
- `services/nlp-interpreter/src/sentinel-bridge.js`

Package test results:

- `services/evidence-vault`: `25/25` passed
- `services/nlp-interpreter`: `42/42` passed

## Scope Note

This phase focused on the places where SAQR currently performs regulatory rule evaluation:

- CDC compliance evaluation in Evidence Vault
- NLP constraint evaluation in the Sentinel bridge

CV Watchman was not materially changed in this phase because it currently performs detection and evidence generation, not regulatory rule evaluation. Its provider/runtime modularization remains covered by `P1-401`.
