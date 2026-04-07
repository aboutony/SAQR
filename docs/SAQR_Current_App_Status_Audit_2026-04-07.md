# SAQR Current App Status Audit

Date: 2026-04-07
Audited against: `SAQR_Current_App_Status.docx`
Repository audited: current workspace state

## Executive Verdict

The document is directionally correct about SAQR's maturity: this is not an MVP, beta, or production-ready platform today.

The best-fit label is:

`Functional pre-MVP demo with real backend plumbing and partial real integrations, but simulated core intelligence, no real API authentication, and heavy demo-mode coupling in the UI.`

## Corrected Findings

| Topic | Document claim | Actual repo status | Verdict |
|---|---|---|---|
| Overall maturity | "Polished demo with real plumbing, not an MVP" | Accurate overall. Evidence Vault, CDC schema, API, scrapers, and CV/NLP service skeletons are real, but the core product value is still not production-grade. | Confirmed |
| Authentication | "No real authentication; session guard is a localStorage key; no JWT validation on API" | No API auth exists. `JWT_SECRET` is present in `.env.example` but unused in the API. The frontend guard is client-side only, but it uses `sessionStorage`, not `localStorage`. | Mostly correct; corrected storage detail |
| CV Watchman | "No actual model; deterministic simulated detection" | Correct. `detector.js` explicitly states Phase A simulated inference and uses deterministic frame-buffer seeding. | Confirmed |
| NLP Interpreter | "Keyword regex matching, no BERT/LLM" | Correct in principle. The NLP layer is rule-based and BERT-compatible only by interface. It is more than one regex file though: it includes parsing, obligation extraction, entity extraction, constraint extraction, and drift logic. | Confirmed with nuance |
| Drift detection | "String diffing with fuzzy match" | Partly correct. It uses normalized text plus Jaccard fuzzy matching and parameter-diff comparison, not just raw string diffing. Still heuristic and brittle compared with model-based semantic comparison. | Partially correct |
| Compliance engine coverage | "Real logic but ~5 rules total" | Roughly correct for active CDC detection logic: 5 explicit rule checks are wired (font size, cooling-off, signage, lighting, expired license). But the database seeds 6 penalty entries, and CV adds 9 visual classes. | Partially correct |
| Penalty schedule size | "5 penalty rules total" | Incorrect. The seeded penalty schedule contains 6 entries. | Incorrect |
| Frontend size/shape | "~4,000 LOC total; app.js is 2,248 lines; monolithic vanilla JS" | Incorrect on counts. The repo is much larger: about 14,393 non-`node_modules` lines. `app.js` is 1,997 lines, not 2,248. The frontend is still largely vanilla JS and demo-heavy, but it is split across multiple files. | Incorrect count; correct direction |
| Demo mode bleed | "Demo mode is interleaved with production code" | Correct. The dashboard auto-activates demo sectors, relies on large embedded `DEMO_DATA`, and only fetches live data when no demo sector is active. | Confirmed |
| Deployment readiness | "No deployment path beyond localhost; only static UI on Vercel; k8s folder empty" | Largely correct. Static UI has Vercel config; API and services have local/dev startup only in-repo; `infra/k8s` is empty. | Confirmed |
| Authority coverage | Implied broad active coverage | Overstated by the app itself. The API heartbeat claims 7 active authorities, but live Sentinel scraping is only implemented for SAMA and SDAIA. Operational rule coverage is much narrower than the UI language suggests. | Important correction |
| Test health | Not mentioned | Evidence Vault, CV Watchman, and Sentinel tests pass. NLP interpreter has 3 failing semantic-extraction tests right now. | Missing from document |

## Evidence Summary

- API auth is absent; the backend only registers CORS and exposes endpoints directly.
- Frontend session gating is client-side only and stored in `sessionStorage`.
- CV detection is explicitly simulated in Phase A.
- NLP extraction is explicitly rule-based in Phase A and marked as BERT-ready for a future swap.
- Drift detection uses fuzzy Jaccard matching plus parameter diffs.
- The compliance engine currently wires 5 CDC-triggered rule checks.
- The penalty schedule seeds 6 violations.
- Sentinel live scraping currently covers only SAMA and SDAIA.
- The UI auto-enters demo behavior and uses embedded demo datasets extensively.
- `infra/k8s` is empty, and only the static UI has Vercel deployment configuration.

## Test Results Run During Audit

- `services/evidence-vault`: 18/18 tests passed
- `services/cv-watchman`: 20/20 tests passed
- `services/sentinel-scrapers`: 14/14 tests passed
- `services/nlp-interpreter`: 29/32 tests passed
  - Failing areas: SAR financial cap extraction, penalty amount extraction, constraint context extraction

## Final Classification

SAQR is currently a strong architecture-first demonstration platform with some real service implementation behind it.

It is beyond a mockup or clickable prototype because:

- there is real schema design,
- immutable evidence-chain logic exists,
- a real API exists,
- live scraper code exists,
- CV and NLP services exist as runnable/testable modules.

It is still before MVP because:

- there is no real API authentication or authorization,
- the UI defaults heavily into demo behavior,
- CV is simulated rather than model-driven,
- NLP is heuristic/rule-based and has failing semantic tests,
- production deployment and operational packaging are incomplete,
- actual live regulatory coverage is much narrower than the app messaging suggests.

## Decision Guidance

If the next course of action is investor/demo storytelling, the platform is credible as a functional demo.

If the next course of action is pilot deployment with a real compliance team, the current document should be corrected to say SAQR is **pre-MVP** and not yet ready for real-world operational rollout without:

1. real auth on the API,
2. separation of demo mode from live mode,
3. hardening/fixing the NLP semantic extraction path,
4. honest narrowing of authority coverage claims,
5. expanded rule coverage and production deployment packaging.
