# SAQR Phase 1 Configuration Guide

Date: 2026-04-07
Scope: Phase 1 demo and production-ready configuration

## Purpose

This guide explains how Phase 1 configuration is organized and what the delivery team must preserve when wiring real environments.

## Source Files

- Demo template: `.env.demo.example`
- Production-ready template: `.env.production.example`
- Shared runtime logic: `shared/runtime-profile.js`
- Shared config validation: `shared/service-config.js`

## Global Runtime Controls

| Variable | Purpose |
|---|---|
| `SAQR_RUNTIME_MODE` | Selects `demo` or `production-ready` behavior. |
| `SAQR_LOG_LEVEL` | Sets structured log verbosity. |
| `SAQR_LOG_INCLUDE_STACKS` | Enables stack traces in structured error logs. |
| `SAQR_AUDIT_LOG_ENABLED` | Enables audit-category log emission. |

## API Configuration

| Variable | Purpose |
|---|---|
| `API_HOST` | API bind host |
| `API_PORT` | API bind port |
| `AUTH_ENABLED` | Enables server-side auth enforcement |
| `JWT_SECRET` | HS256 signing secret placeholder for delivery wiring |
| `AUTH_JWT_ISSUER` | Expected token issuer |
| `AUTH_JWT_AUDIENCE` | Expected token audience |
| `SAQR_REGULATORY_AUTHORITIES` | Authority list surfaced through runtime metadata |

## Shared Database Configuration

These variables are reused across the runtime services:

- `SHADOW_DB_HOST`
- `SHADOW_DB_PORT`
- `SHADOW_DB_NAME`
- `SHADOW_DB_USER`
- `SHADOW_DB_PASSWORD`

Production-ready runtime rejects placeholder values for these settings.

## Service-Specific Controls

### Evidence Vault

- `KAFKA_BOOTSTRAP_SERVERS`
- `KAFKA_CLIENT_ID`
- `KAFKA_GROUP_ID`
- `EVIDENCE_VAULT_TOPICS`
- `NTP_SERVER`
- `NTP_TIMEOUT_MS`
- `EVIDENCE_VAULT_VALIDATE_DB_ON_STARTUP`
- `EVIDENCE_VAULT_VALIDATE_NTP_ON_STARTUP`

### Sentinel

- `SENTINEL_MODE`
- `SENTINEL_CRON`
- `SENTINEL_VALIDATE_DB_ON_STARTUP`
- `SENTINEL_BROWSER_HEADLESS`

### NLP

- `NLP_BOOT_MODE`
- `NLP_VALIDATE_DB_ON_STARTUP`

### CV Watchman

- `VMS_TYPE`
- `CV_SCAN_INTERVAL`
- `CV_VALIDATE_DB_ON_STARTUP`
- `CV_VMS_HOST`
- `CV_VMS_PORT`
- `CV_VMS_USERNAME`
- `CV_VMS_PASSWORD`
- `CV_VMS_USE_TLS`
- `CV_VMS_APP_ID`
- `CV_VMS_MAX_FPS`

### UI Deployment Injection

- `SAQR_UI_API_BASE`
- `SAQR_UI_AUTH_ENABLED`
- `SAQR_UI_TOKEN_STORAGE_KEY`
- `SAQR_UI_RUNTIME_PROFILE`
- `SAQR_UI_STATIC_BEARER_TOKEN`

## Demo vs Production-Ready Rules

- Demo mode may allow simulated providers and relaxed startup checks.
- Production-ready mode must not allow demo-only boot modes or demo provider choices where prohibited by config builders.
- Production-ready mode rejects placeholder secrets and placeholder connection targets.
- Local-host warnings in production-ready mode should be treated as delivery action items, not ignored forever.

## Configuration Hygiene Rules

1. Do not commit real client secrets into this repository.
2. Do not bypass runtime validation to force a service up in production-ready mode.
3. Keep environment-variable changes synchronized with the delivery contracts and release checklist.
4. If a new runtime variable is introduced, update:
   - the relevant config builder
   - the environment templates
   - the configuration guide
   - the delivery contract artifacts if the change affects handoff expectations

