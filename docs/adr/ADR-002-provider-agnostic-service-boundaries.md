# ADR-002: Use Provider-Agnostic Service Boundaries for Delivery-Owned Integrations

Date: 2026-04-07
Status: Accepted

## Context

Phase 1 cannot assume access to the client database, Kafka deployment, VMS environment, or third-party systems. The repository still needs to hand the delivery team working algorithms instead of abstract slides.

## Decision

Core SAQR flows will be structured around provider contracts, adapters, and modular rule engines. The repository will contain:

- executable default implementations
- contract-backed adapter seams
- infrastructure-free replay fixtures and acceptance harnesses

## Consequences

- Delivery can replace infrastructure providers without rewriting core orchestration.
- Tests can prove behavior before real client connectivity exists.
- The codebase remains honest about which seams are implemented and which remain delivery-wired.
- Teams must preserve the contracts when introducing real integrations, or they risk breaking the acceptance pack and service assumptions.

