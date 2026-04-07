# SAQR Phase 1: CI, Quality Gates, and Release Workflow

Date: 2026-04-07
Scope: `P1-602`

## Outcome

Phase 1 now has a free-toolchain CI path, a repeatable local quality-gate runner, and a manual release-readiness workflow for the production-ready track.

## Artifacts

- Root command entrypoint: `package.json`
- Workspace bootstrap script: `tools/ci/bootstrap-workspace.js`
- Handoff-package verifier: `tools/ci/verify-phase1-handoff-package.js`
- Local and CI quality-gate runner: `tools/ci/run-phase1-quality-gates.js`
- Release-readiness runner: `tools/ci/run-phase1-release-readiness.js`
- Continuous quality workflow: `.github/workflows/phase1-quality-gates.yml`
- Manual release-readiness workflow: `.github/workflows/phase1-release-readiness.yml`
- Machine-readable pipeline contract: `docs/contracts/saqr-delivery-pipeline.yaml`
- Human checklist: `docs/checklists/SAQR_Phase1_Release_Checklist.md`

## Quality Gates

The Phase 1 quality gate sequence now checks:

1. Node syntax validity across runtime and tooling JavaScript files.
2. Package-level test suites for API, Evidence Vault, NLP Interpreter, CV Watchman, and Sentinel.
3. UI freeze compliance through the existing UI baseline manifest.
4. Acceptance replay coverage through the fixture harness.
5. Final Phase 1 handoff package verification.
6. Production compose configuration validity.

## Workflow Model

- `phase1-quality-gates.yml` runs on push, pull request, and manual dispatch.
- `phase1-release-readiness.yml` runs only on manual dispatch because container builds are intentionally treated as a release-level gate, not a per-commit gate.
- `bootstrap-workspace.js` uses only npm and Node, and avoids Playwright browser downloads during CI bootstrap.

## Release Positioning

This phase adds delivery-pipeline discipline, but it does not replace final delivery-team release management. Real client cutover still depends on:

- client infrastructure prerequisites
- delivery-team environment wiring
- environment-specific pilot validation and signoff

The final repo entrypoint for that closeout is now `docs/handoff/README.md`.

## Scope Notes

- No UI/UX baseline files were changed in this phase.
- The CI path uses only free tools already aligned with the repo: Node, npm, GitHub Actions, and Docker Compose.
