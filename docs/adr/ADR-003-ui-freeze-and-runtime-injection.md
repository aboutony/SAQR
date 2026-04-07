# ADR-003: Freeze UI/UX and Use Runtime Injection for Deployment Variability

Date: 2026-04-07
Status: Accepted

## Context

The user set a non-negotiable rule that the UI/UX must not change unless jointly approved. At the same time, the production-ready UI needed to work in real deployment topologies instead of assuming localhost endpoints.

## Decision

The tracked UI baseline will be frozen, and deployment-time variation will be handled through runtime configuration injection rather than UI redesign or code-path drift.

This includes:

- a tracked UI baseline manifest
- a regression checker for UI drift
- runtime config injection for deployed UI endpoint values

## Consequences

- The visual client demo remains stable.
- Deployment portability improves without redesigning the interface.
- UI changes require explicit approval and baseline refresh discipline.
- Delivery must treat runtime config as the correct place for endpoint variation, not ad hoc UI file edits.

