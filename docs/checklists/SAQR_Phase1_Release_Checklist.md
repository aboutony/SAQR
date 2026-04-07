# SAQR Phase 1 Release Checklist

Date: 2026-04-07
Scope: `P1-602`

Use this checklist before a Phase 1 delivery candidate is handed to the delivery team or used as the working production-ready baseline.

## Mandatory Checks

1. Run `npm run phase1:bootstrap` on a clean clone or clean runner.
2. Run `npm run phase1:handoff:verify` and confirm the handoff package passes.
3. Run `npm run phase1:quality:ci` and confirm all gates pass.
4. Run `npm run phase1:release:verify -- --build-containers` for release candidates.
5. Confirm the demo environment remains untouched and the production-ready path remains separate.
6. Confirm `apps/shield-ui/ui-baseline.manifest.json` still passes `npm run ui:baseline:check`.
7. Confirm `.env.production.example` still contains placeholders only, not real client secrets.
8. Confirm `infra/docker-compose.production.yml` and `infra/k8s/base/*` still match the documented runtime contracts.
9. Confirm delivery-team docs, contracts, and the handoff package stay synchronized when runtime or deployment seams change.

## Delivery Handoff Notes

- Client prerequisites remain external to this repository.
- Final client identity, DB, Kafka, VMS, DNS, TLS, ingress, and storage wiring belong to the delivery team.
- The final Phase 1 repo handoff entrypoint is `docs/handoff/README.md`.
