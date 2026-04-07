# SAQR Phase 1 Dependency Incident Runbook

Date: 2026-04-07
Scope: Phase 1 dependency outage and failure handling

## Purpose

This runbook gives the delivery team the expected Phase 1 reaction to common dependency failures.

## Shadow PostgreSQL Unavailable

### Expected Impact

- API health and read queries fail.
- Evidence Vault, NLP, CV, and Sentinel may fail startup or continue with degraded behavior depending on validation flags.

### Actions

1. Check host, port, credentials, and network reachability.
2. Confirm the runtime is not still using placeholder values.
3. Review structured logs for `dependency.shadow_db.*` events.
4. Restart affected services only after DB connectivity is restored.

## Kafka or Kafka Connect Unavailable

### Expected Impact

- Evidence Vault cannot subscribe to CDC topics.
- CDC ingestion pauses.
- Downstream evidence generation from CDC stops.

### Actions

1. Check Kafka broker availability and topic configuration.
2. Confirm Debezium connector registration and source replication state.
3. Review Evidence Vault logs for Kafka connection or subscription failures.

## NTP Authority Unavailable

### Expected Impact

- In production-ready runtime, Evidence Vault startup should fail if NTP validation is required.
- In demo mode, system-clock fallback may be allowed.

### Actions

1. Confirm NTP host reachability.
2. Review `NTP_SERVER`, timeout, and fallback settings.
3. Do not silently enable fallback in production-ready runtime without explicit delivery approval.

## VMS Unavailable

### Expected Impact

- CV Watchman fails startup or cannot complete scan cycles.
- Visual evidence generation pauses.

### Actions

1. Confirm VMS endpoint, port, credentials, and TLS posture.
2. Review logs for VMS connection failures.
3. Verify the selected `VMS_TYPE` matches the intended provider.

## Regulatory Source Scraping Failure

### Expected Impact

- Sentinel scrape sessions fail or return partial authority coverage.
- Staging ingestion falls behind.

### Actions

1. Review Sentinel logs for browser launch or scrape-session failures.
2. Confirm regulatory portal availability and any selector drift.
3. If required, switch to a manual replay path using the Phase 1 acceptance harness while delivery adjusts live scraping.

## Token or Identity Failure

### Expected Impact

- Protected API routes return authorization failures.
- UI may load but fail to retrieve authenticated data.

### Actions

1. Confirm token issuance, audience, issuer, and bearer token delivery.
2. Review API auth logs and JWT settings.
3. Do not work around auth failures by re-enabling demo fallback in production-ready runtime.

