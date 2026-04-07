# SAQR Phase 1 Environment Split

Date: 2026-04-07
Phase: 1
Scope: Demo preservation plus production-ready handoff environment

## Purpose

Phase 1 starts by separating SAQR into two runtime profiles without redesigning the UI:

- Demo environment: keeps the current client demo experience intact.
- Production-ready environment: uses the same UI assets, but disables demo-only behavior and routes the product through live-ready execution paths.

This split is intentionally configuration-driven so the delivery team can deploy both environments from one codebase.

## Non-Negotiables Applied

- The current demo experience remains the default runtime.
- UI/UX styling and layout are not redesigned.
- No live DB or third-party dependencies are assumed in this repository.
- Only free/open-source-compatible tooling is used.
- Documentation is created alongside implementation.

## What Was Implemented

### 1. Runtime-config split for Shield UI

Added three runtime files in [apps/shield-ui](C:/Users/fahme/.gemini/antigravity/scratch/saqr/apps/shield-ui):

- [runtime-config.js](C:/Users/fahme/.gemini/antigravity/scratch/saqr/apps/shield-ui/runtime-config.js)
- [runtime-config.demo.js](C:/Users/fahme/.gemini/antigravity/scratch/saqr/apps/shield-ui/runtime-config.demo.js)
- [runtime-config.production.js](C:/Users/fahme/.gemini/antigravity/scratch/saqr/apps/shield-ui/runtime-config.production.js)

Current behavior:

- `runtime-config.js` is the active default and preserves the demo environment.
- `runtime-config.production.js` defines the production-ready runtime profile.

### 2. Entry pages now load runtime config

Both UI entry pages now load runtime config before session/runtime logic:

- [index.html](C:/Users/fahme/.gemini/antigravity/scratch/saqr/apps/shield-ui/index.html)
- [GatewaySelector.html](C:/Users/fahme/.gemini/antigravity/scratch/saqr/apps/shield-ui/GatewaySelector.html)

### 3. Session context now records runtime profile

[SessionArchitect.js](C:/Users/fahme/.gemini/antigravity/scratch/saqr/apps/shield-ui/SessionArchitect.js) now stores runtime mode/profile in the session object so the delivery team can reason about environment behavior through the client session contract.

### 4. Production-ready runtime guardrails in dashboard logic

[app.js](C:/Users/fahme/.gemini/antigravity/scratch/saqr/apps/shield-ui/app.js) now supports configuration-driven behavior:

- Demo data can be disabled.
- Demo auto-activation can be disabled.
- Executive simulation controls can be disabled.
- Simulation helpers can be withheld from `window`.
- Demo workflow automation can be disabled.
- Silent API fallback can be disabled.

Important result:

- Demo stays exactly as before under the default runtime.
- Production-ready runtime no longer depends on demo auto-activation.

### 5. Live breakdown rendering path was repaired

The live authority breakdown loader in [app.js](C:/Users/fahme/.gemini/antigravity/scratch/saqr/apps/shield-ui/app.js) previously targeted stale DOM IDs and would fail outside demo mode.

It now renders via the existing dynamic breakdown component, which makes the production-ready runtime viable without changing the UI design.

### 6. Root environment profile examples were added

Added:

- [.env.demo.example](C:/Users/fahme/.gemini/antigravity/scratch/saqr/.env.demo.example)
- [.env.production.example](C:/Users/fahme/.gemini/antigravity/scratch/saqr/.env.production.example)

These are delivery-team-ready placeholders, not live infrastructure configs.

## Runtime Behavior Matrix

| Capability | Demo runtime | Production-ready runtime |
|---|---|---|
| Embedded demo data | Enabled | Disabled |
| Demo auto-activation | Enabled | Disabled |
| Simulate buttons | Enabled | Disabled |
| Console simulation helpers | Enabled | Disabled |
| Demo ticket auto-lifecycle | Enabled | Disabled |
| Silent fallback when staging API is unavailable | Enabled | Disabled |
| Live dashboard path | Secondary | Primary |

## How To Use The Two Environments

### Demo environment

Use the current default files:

- [runtime-config.js](C:/Users/fahme/.gemini/antigravity/scratch/saqr/apps/shield-ui/runtime-config.js)
- [.env.demo.example](C:/Users/fahme/.gemini/antigravity/scratch/saqr/.env.demo.example)

This preserves the existing client-demo behavior.

### Production-ready handoff environment

For delivery/handoff packaging:

1. Use [.env.production.example](C:/Users/fahme/.gemini/antigravity/scratch/saqr/.env.production.example) as the configuration baseline.
2. Serve the Shield UI with [runtime-config.production.js](C:/Users/fahme/.gemini/antigravity/scratch/saqr/apps/shield-ui/runtime-config.production.js) in place of the active `runtime-config.js`.
3. Keep the same HTML/CSS/UI assets.
4. Connect real DB/VMS/regulatory integrations later through the delivery team.

## What This Does Not Yet Do

- It does not introduce live auth/authz yet.
- It does not connect to a real DB, VMS, or external regulatory sources.
- It does not yet refactor all backend services into fully separated demo/live adapters.
- It does not yet complete the production handoff package.

Those are still Phase 1 tasks and remain tracked in [SAQR_Phase_1_Phase_2_Tracker.md](C:/Users/fahme/.gemini/antigravity/scratch/saqr/docs/SAQR_Phase_1_Phase_2_Tracker.md).

## Immediate Next Build Step

Next, Phase 1 should continue with:

- hard separation of demo-path leakage from backend/service execution,
- auth/authz framework scaffolding,
- production-ready API/service contracts,
- algorithm stabilization and test hardening.
