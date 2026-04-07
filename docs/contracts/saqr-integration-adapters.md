# SAQR Integration Adapter Contracts

Date: 2026-04-07
Scope: Phase 1 `P1-502`

## Purpose

This document defines the interface-ready adapter package the delivery team will use to connect SAQR to real infrastructure without changing the application logic or the frozen UI.

## Adapter Families

| Adapter Family | Primary Files | Purpose |
|---|---|---|
| PostgreSQL query adapter | `shared/postgres-adapter.js` | Standardize DB health checks, query execution, and connection shutdown. |
| Regulatory source adapters | `services/sentinel-scrapers/src/source-adapters.js` | Standardize external authority collection behind provider-style fetch contracts. |
| Regulatory staging adapter | `services/sentinel-scrapers/src/bridge.js` | Standardize persistence into `shadow.regulatory_staging`. |
| VMS provider adapter | `services/cv-watchman/src/vms/vms-adapter.js` | Standardize camera discovery and frame access across built-in and custom VMS providers. |

## PostgreSQL Query Adapter

Factory:

- `createPostgresAdapter(pool, options)`

Required underlying pool methods:

- `query(text, params)`

Exposed adapter methods:

- `query(text, params)`
- `healthcheck(sql?)`
- `close()`

Current production-ready consumers:

- `apps/api/src/index.js`
- `services/evidence-vault/src/index.js`
- `services/nlp-interpreter/src/index.js`
- `services/cv-watchman/src/index.js`
- `services/sentinel-scrapers/src/bridge.js`

Delivery-team rule:

- Replace the underlying `pg` pool if needed, but preserve the adapter contract so repository providers and services do not change.

## Regulatory Source Provider Contract

Factory helpers:

- `createRegulatorySourceProvider({ authority, liveScraper, demoScraper })`
- `createDefaultRegulatorySourceRegistry()`
- `resolveRegulatorySources(authorities, registry)`
- `createRegulatorySourceOrchestrator({ sources, logger })`

Required provider method:

- `fetchEntries({ mode, browser, logger })`

Expected output shape:

```json
{
  "authority": "SAMA",
  "title": "Circular title",
  "sourceUrl": "https://authority.example/rule",
  "category": "Consumer Protection",
  "publishDate": "2026-04-07",
  "contentHash": "hex-sha256",
  "detectedAt": "2026-04-07T09:30:00.000Z"
}
```

Delivery-team rule:

- New authority connectors should be added by registering a provider in the source registry, not by rewriting the Sentinel orchestrator.

## Regulatory Staging Repository Contract

Factory helpers:

- `createPostgresRegulatoryStagingRepository(queryAdapter)`
- `createRegulatoryStagingIngestionFlow({ repository, logger })`

Required repository method:

- `upsertRule(rule)`

Expected result shape:

```json
{
  "inserted": true,
  "duplicate": false
}
```

Delivery-team rule:

- Alternative sinks are allowed, but they must preserve idempotent `content_hash` behavior and the ingestion summary contract.

## VMS Provider Contract

Factory helpers:

- `createDefaultVmsProviderRegistry()`
- `createVmsProvider({ type, connection, registry })`
- `new VmsAdapter({ type, connection, registry, logger })`

Required provider methods:

- `authenticate()`
- `getCameras()`
- `grabFrame(cameraId)`
- `getStatus()`

Expected camera shape:

```json
{
  "id": "CAM-BRANCH-01",
  "name": "Main Entrance Camera",
  "enabled": true,
  "type": "milestone"
}
```

Expected frame shape:

```json
{
  "buffer": "binary frame bytes",
  "timestamp": "2026-04-07T09:35:00.000Z",
  "cameraId": "CAM-BRANCH-01",
  "source": "milestone",
  "width": 1920,
  "height": 1080
}
```

Delivery-team rule:

- Supported built-ins remain `milestone`, `genetec`, and `demo`, but production deployment can inject a custom registry-backed provider without editing the CV scan flow.

## Scope Notes

- These adapters are interface-ready only. Real DB, VMS, and authority connectivity still belong to the delivery team.
- No UI or UX files are part of this adapter package.
