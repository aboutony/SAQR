# SAQR Phase 1: Deployment Blueprint and Container Strategy

Date: 2026-04-07
Scope: `P1-601`

## Outcome

Phase 1 now includes a delivery-team deployment package for the production-ready SAQR track. It does not attempt to ship client infrastructure inside this repo. Instead, it packages the SAQR services cleanly for:

- on-prem or workstation dry-run deployment via Docker Compose
- sovereign-cloud or on-prem Kubernetes deployment via base manifests

## Artifacts

- Docker build context guardrails: `.dockerignore`
- UI image packaging: `apps/shield-ui/Dockerfile`
- API image packaging: `apps/api/Dockerfile`
- Evidence Vault image packaging: `services/evidence-vault/Dockerfile`
- NLP Interpreter image packaging: `services/nlp-interpreter/Dockerfile`
- CV Watchman image packaging: `services/cv-watchman/Dockerfile`
- Sentinel image packaging: `services/sentinel-scrapers/Dockerfile`
- UI runtime injection entrypoint: `apps/shield-ui/docker-entrypoint.d/40-runtime-config.sh`
- Self-hosted handoff composition: `infra/docker-compose.production.yml`
- Kubernetes template set: `infra/k8s/base/*`
- Machine-readable blueprint: `docs/contracts/saqr-deployment-blueprint.yaml`

## What Was Added

1. A container image for each runnable SAQR component in the production-ready path.
2. A production compose profile that starts the SAQR platform containers while leaving DB, Kafka, VMS, and IdP prerequisites external.
3. A Kubernetes base template with namespace, config, secret, deployment, service, and ingress placeholders.
4. Runtime-safe UI container injection so the deployed UI can point to a real API endpoint without changing the visual design.

## Deployment Positioning

This repository still does not contain live client prerequisites. The delivery team must provide or connect:

- shadow PostgreSQL
- Kafka and Kafka Connect / Debezium
- VMS endpoint and credentials
- token issuer / identity integration
- ingress, DNS, TLS, and cluster security controls

## Scaling Guidance

- `saqr-api`: horizontally scalable, default packaging uses 2 replicas in Kubernetes.
- `saqr-shield-ui`: horizontally scalable, default packaging uses 2 replicas in Kubernetes.
- `saqr-sentinel-scrapers`: singleton by default to avoid duplicate scrape sessions unless delivery introduces coordination.
- `saqr-cv-watchman`: singleton by default unless camera partitioning is explicitly designed.
- `saqr-nlp-interpreter`: singleton by default in Phase 1.
- `saqr-evidence-vault`: one replica by default in Phase 1 packaging; delivery may scale later with explicit Kafka partitioning and idempotency review.

## Scope Notes

- No tracked UI/UX baseline files were changed in this phase.
- The UI runtime injection only replaces deployment-time endpoint values; it does not redesign or restyle the interface.
- The Kubernetes manifests are handoff templates, not final client cluster manifests.

