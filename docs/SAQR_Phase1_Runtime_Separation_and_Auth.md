# SAQR Phase 1 Runtime Separation and Auth

Date: 2026-04-07
Scope: `P1-104` and `P1-301`

## Objective

Move SAQR further from pre-MVP demo behavior by:

- keeping the current client-demo environment intact
- preventing production-ready runtime paths from silently falling back to demo behavior
- adding an interface-ready auth/authz layer without changing the UI/UX design

## Completed Outputs

| Task ID | Status | Result |
|---|---|---|
| P1-104 | Completed | Demo/live execution paths are now runtime-aware across UI, API, Sentinel, and CV entrypoints. |
| P1-301 | Completed | Production-ready API auth/authz scaffolding is now in place with JWT validation, permission guards, UI bearer-token support, and tests. |

## Runtime Separation Summary

| Component | Demo Runtime | Production-Ready Runtime |
|---|---|---|
| Shield UI | Demo data enabled, simulation helpers enabled, silent API fallback allowed | Demo data disabled, simulation helpers disabled, silent API fallback disabled |
| Shield UI API calls | No auth header required by default | Adds bearer token from `sessionStorage['saqr_api_bearer_token']` when present |
| API | Auth disabled by default | Auth forced on, `JWT_SECRET` required |
| API source heartbeat | Public by default | Protected by default |
| API authorities | Defaults to `SAMA,SDAIA,ZATCA,SFDA,MOH,MOMAH,MHRSD` | Defaults to `SAMA,SDAIA` |
| Sentinel | Defaults to `demo` mode | Defaults to `live` mode and rejects `SENTINEL_MODE=demo` |
| CV Watchman | Defaults to `VMS_TYPE=demo` | Defaults to `VMS_TYPE=milestone` and rejects `VMS_TYPE=demo` |

## Auth/Authz Contract

Implementation location:

- `apps/api/src/auth.js`
- `apps/api/src/platform-config.js`

Model:

- Stateless JWT verification using Node.js built-in `crypto`
- Algorithm: `HS256`
- No paid or proprietary tooling introduced

Required production-ready behavior:

- `SAQR_RUNTIME_MODE=production` or `production-ready` forces API auth on
- `JWT_SECRET` is mandatory in production-ready runtime
- Protected routes require bearer auth unless explicitly public

Supported JWT claims:

| Claim | Required | Purpose |
|---|---|---|
| `sub` | Recommended | Subject / user identifier |
| `iss` | Yes in production-ready | Must match `AUTH_JWT_ISSUER` |
| `aud` | Yes in production-ready | Must match `AUTH_JWT_AUDIENCE` |
| `exp` | Recommended | Token expiry |
| `nbf` | Optional | Not-before enforcement |
| `role` or `roles` | Recommended | Maps user to SAQR role permissions |
| `permissions` | Optional | Adds explicit grants |
| `tenant_id` or `tenantId` | Optional | Reserved for future multi-entity support |

Current role model:

| Role | Purpose |
|---|---|
| `viewer` | Read-only dashboard, evidence, references, NLP, CV, and source visibility |
| `analyst` | Viewer plus CDC visibility |
| `auditor` | Analyst plus audit visibility |
| `board` | Executive visibility for dashboard, violations, evidence, and sources |
| `admin` | Full access |

## UI Integration Contract

The UI design was not changed.

The production-ready runtime now supports API auth without adding or changing screens:

- bearer token lookup key: `saqr_api_bearer_token`
- storage location: `sessionStorage`
- config location: `apps/shield-ui/runtime-config.production.js`

Delivery-team expectation:

1. Authenticate the operator through the chosen identity layer.
2. Store the issued bearer token in `sessionStorage['saqr_api_bearer_token']`.
3. Keep the existing SAQR UI unchanged.

## Service Safety Guards

The following silent demo fallbacks were removed from production-ready runtime behavior:

- Sentinel will now reject invalid `SENTINEL_MODE` values and will reject `demo` mode in production-ready runtime.
- CV Watchman will now reject invalid `VMS_TYPE` values and will reject `demo` VMS in production-ready runtime.
- `VmsAdapter` now rejects unsupported adapter types instead of falling through to demo behavior.

## Environment Variables Added or Hardened

Relevant examples were updated in:

- `.env.demo.example`
- `.env.production.example`

Added or clarified variables:

- `AUTH_ENABLED`
- `AUTH_JWT_ISSUER`
- `AUTH_JWT_AUDIENCE`
- `AUTH_JWT_LEEWAY_SECONDS`
- `PUBLIC_SOURCES_HEARTBEAT_ENABLED`
- `SAQR_REGULATORY_AUTHORITIES`

## Verification Completed

Commands executed:

- `node --check apps/api/src/index.js`
- `node --check apps/api/src/auth.js`
- `node --check apps/api/src/platform-config.js`
- `node --check apps/shield-ui/app.js`
- `node --check services/sentinel-scrapers/src/index.js`
- `node --check services/cv-watchman/src/index.js`
- `npm test` in `apps/api`
- `npm test` in `services/sentinel-scrapers`
- `npm test` in `services/cv-watchman`

Results:

- API tests: 9/9 passed
- Sentinel tests: 14/14 passed
- CV Watchman tests: 20/20 passed

## Known Limits

- No live database, VMS, or third-party connectivity was introduced in this phase.
- Auth is interface-ready, not IdP-integrated.
- Token issuance and secret management remain delivery-team responsibilities.
- Production-ready runtime is hardened against demo leakage, but full delivery readiness still requires the remaining Phase 1 work items.
