# ADR-001: Preserve Demo Runtime and Add Production-Ready Runtime Separation

Date: 2026-04-07
Status: Accepted

## Context

The current SAQR demo environment must remain available for active client demos, while Phase 1 also needs a production-ready track that blocks demo-only behavior and validates real delivery prerequisites.

## Decision

SAQR will keep two runtime modes:

- `demo`
- `production-ready`

Runtime behavior is controlled centrally through `SAQR_RUNTIME_MODE` and shared runtime helpers rather than by ad hoc component flags.

## Consequences

- Demo behavior can remain intact without polluting production-ready execution paths.
- Production-ready services can fail fast on placeholder secrets and invalid demo modes.
- Delivery can use one codebase without maintaining a separate branch for demo versus handoff packaging.
- Teams must respect runtime mode semantics; bypassing them would reintroduce demo leakage.

