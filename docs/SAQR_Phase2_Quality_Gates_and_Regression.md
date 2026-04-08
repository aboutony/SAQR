# SAQR Phase 2: Quality Gates and Regression Coverage

Date: 2026-04-08
Scope: `P2-302`

## Outcome

Phase 2 now has a dedicated verification lane in the free-toolchain path. It is intentionally separate from the Phase 1 release-readiness path so the delivery team can validate the new workflow, multi-entity, and sovereign model work without weakening the Phase 1 baseline discipline.

## Artifacts

- Root commands: `package.json`
- Quality-gate runner: `tools/ci/run-phase2-quality-gates.js`
- Handoff-package verifier: `tools/ci/verify-phase2-handoff-package.js`
- GitHub Actions workflow: `.github/workflows/phase2-quality-gates.yml`
- Verification contract: `docs/contracts/saqr-phase2-verification-pipeline.yaml`
- Acceptance fixtures and harness: `docs/SAQR_Phase2_Mock_Harnesses_and_Acceptance_Payloads.md`
- Handoff validation guide: `docs/handoff/SAQR_Phase2_Validation_Guide.md`

## Commands

- Handoff-package verification: `npm run phase2:handoff:verify`
- Local verification: `npm run phase2:quality`
- CI verification: `npm run phase2:quality:ci`

## Gate Coverage

1. Syntax checks across the Phase 2 workflow engine, shared multi-entity and sovereign modules, and Phase 2 tooling.
2. Workflow regression coverage through the workflow DSL validator, workflow engine tests, and workflow-definition validation.
3. Multi-entity regression coverage through hierarchy, scoping, isolation, roll-up, and reporting tests plus their validators.
4. Sovereign regression coverage through topology, policy, and packaging tests plus their validators.
5. Phase 2 acceptance replays covering maker-checker workflow execution, committee workflow execution, and multi-entity reporting/access behavior.
6. Phase 2 handoff-package verification covering the manifest shape, required docs, and referenced repo artifacts.
7. UI baseline protection through the existing Phase 1 UI-freeze checker.
8. Sovereign deployment overlay validation through `docker compose config` across all supported rollout overlays.

## Delivery-Team Guidance

- Use `npm run phase2:handoff:verify` whenever you touch the Phase 2 handoff docs or want to confirm the package is still structurally complete.
- Use `npm run phase2:quality` as the default pre-merge verification command for Phase 2 backend work.
- Use `npm run phase2:quality:ci` in automation or when you need Docker to be a hard requirement instead of an optional local convenience.
- Keep the Phase 2 acceptance fixtures green before changing workflow runtime semantics, entity access semantics, or sovereign rollout packaging.
- Treat the UI baseline gate as non-negotiable unless a separately approved UI change exists.

## Scope Notes

- No UI or UX files were changed in this phase.
- This verification lane does not replace Phase 1 release readiness. It complements it by targeting the new Phase 2 architecture.
- The handoff-package gate verifies repo completeness only. It does not claim delivery-environment or pilot completion.
- The compose overlay gate validates configuration structure only. It does not claim live infrastructure deployment or client-environment readiness.
