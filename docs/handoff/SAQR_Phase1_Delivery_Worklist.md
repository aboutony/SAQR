# SAQR Phase 1 Delivery Worklist

Date: 2026-04-07
Scope: Delivery-owned work after repo handoff

## Identity and API Access

- Wire a real token issuer or IdP to the Phase 1 JWT contract.
- Issue bearer tokens with the expected issuer, audience, and role/permission mapping.
- Validate protected API access from the frozen UI without re-enabling demo fallback.

## Shadow Database and Schema

- Provision the target shadow PostgreSQL environment.
- Apply the documented schema and migration sequence in the target environment.
- Validate service access, credentials, and least-privilege posture for API, Vault, NLP, CV, and Sentinel.

## CDC and Messaging

- Provision Kafka and Kafka Connect / Debezium.
- Register and validate the CDC connector artifacts in `services/cdc-connector`.
- Confirm expected topic creation, CDC event flow, and downstream Evidence Vault consumption.
- Add delivery-side retry, DLQ, and operating controls where Phase 1 currently documents only the required behavior.

## Regulatory Sources

- Validate live SAMA and SDAIA scraping in the target environment.
- Confirm browser runtime, outbound connectivity, and selector stability.
- Add more authorities only if the client scope requires them; do not overstate current live coverage.

## CV and VMS

- Connect the target VMS provider and credentials.
- Validate camera access, scan-cycle behavior, and evidence persistence against the real environment.
- Perform pilot calibration and operational validation before any client production claim.

## Platform Deployment

- Replace placeholder secrets and connection targets.
- Tailor compose or Kubernetes packaging to the client topology.
- Configure ingress, DNS, TLS, network policy, image registry, and cluster controls.
- Keep the demo environment separate from the production-ready deployment path.

## Operational Readiness

- Run the full Phase 1 validation path after environment wiring.
- Review structured logs, health signals, and service startup validation behavior.
- Capture delivery signoff that the repo-backed package and the client-specific environment wiring both pass.

## Explicitly Out Of Scope For Phase 1

- LogicGate-style no-code workflow engine
- Archer-style multi-entity model
- cross-entity reporting and sovereign topology expansion beyond the current Phase 1 packaging

