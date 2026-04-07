# SAQR Phase 1 UI Freeze and Regression Guardrails

Date: 2026-04-07
Scope: `P1-201`, `P1-202`

## Objective

Freeze the approved SAQR UI/UX baseline and add a free, repo-local regression check that detects unintended drift without changing the interface.

## Completed Result

`P1-201` and `P1-202` are now complete.

## What Was Added

New artifacts:

- `apps/shield-ui/package.json`
- `apps/shield-ui/tools/ui-regression-check.js`
- `apps/shield-ui/ui-baseline.manifest.json`

Capabilities added:

- strict UI baseline manifest for the approved interface
- zero-cost hash-based drift detection using Node built-ins only
- explicit approval protocol for any future UI change
- documented boundary between frozen UI files and allowed runtime-only configuration files

## Frozen UI Scope

The current approved UI surface is frozen across 13 tracked files:

- `apps/shield-ui/app.js`
- `apps/shield-ui/AuthorityMapper.js`
- `apps/shield-ui/CDCPipeline.js`
- `apps/shield-ui/CourtReadyReport.js`
- `apps/shield-ui/Dispatcher.js`
- `apps/shield-ui/GatewaySelector.html`
- `apps/shield-ui/index.html`
- `apps/shield-ui/SessionArchitect.js`
- `apps/shield-ui/SettingsModal.js`
- `apps/shield-ui/styles.css`
- `apps/shield-ui/TranslatorCore.js`
- `apps/shield-ui/VerticalPruner.js`
- `apps/shield-ui/WorkflowManager.js`

The baseline manifest stores:

- normalized SHA-256 hash
- line count
- byte count
- role classification for each tracked UI file

Excluded from the freeze because they are environment-only or tooling-only:

- `apps/shield-ui/runtime-config.js`
- `apps/shield-ui/runtime-config.demo.js`
- `apps/shield-ui/runtime-config.production.js`
- `apps/shield-ui/package.json`
- `apps/shield-ui/tools/*`
- `apps/shield-ui/vercel.json`

## Guardrails

1. No tracked UI file may be changed without explicit written approval.
2. Any intentional UI change must be visually reviewed in both demo and production-ready runtimes before the baseline is refreshed.
3. The baseline manifest may only be refreshed after the approved review is complete.
4. Runtime-only changes in `runtime-config*.js` do not require UI approval if they do not alter presentation.
5. Backend, service, test, documentation, and deployment work can proceed freely unless it modifies a tracked UI file.

## Commands

Run from `apps/shield-ui`:

- `npm run ui:baseline:check`
- `npm run ui:baseline:write`

Behavior:

- `ui:baseline:check` fails on changed, missing, or newly introduced tracked UI files
- `ui:baseline:write` refreshes the manifest and must only be used after approved UI review

## Manual Review Checklist

When an approved UI change is requested, review at minimum:

1. `GatewaySelector.html` in the demo runtime
2. `index.html` in the demo runtime
3. `index.html` in the production-ready runtime
4. typography, colors, spacing, and layout hierarchy
5. critical overlays and workflow surfaces:
   - settings modal
   - court-ready report
   - workflow manager surfaces

## Verification

Completed checks:

- `node --check apps/shield-ui/tools/ui-regression-check.js`
- `npm run ui:baseline:write`
- `npm run ui:baseline:check`

Result:

- the approved UI baseline is captured in `apps/shield-ui/ui-baseline.manifest.json`
- the automated drift check currently passes for all 13 tracked files

## Delivery-Team Guidance

- treat the current UI as locked unless a business-approved change request exists
- run `npm run ui:baseline:check` before merging any branch that touches `apps/shield-ui`
- if the command fails unexpectedly, treat that as a stop signal until the drift is reviewed
- do not refresh the baseline to silence the check without explicit approval
