# 🦅 SAQR — Violation Interceptor

**صقر** (Falcon) — A non-intrusive compliance observation platform for Saudi Banking (SAMA) and Municipal (MOMAH) sectors.

## Golden Rule

> SAQR never writes to client systems. All data flows are **read-only** via Change Data Capture (CDC).

## Architecture

```
Client DB (Oracle/MSSQL) → Debezium CDC → Kafka → Shadow DB → Compliance Engine → Evidence Vault → Shield UI
Client CCTV (VMS) → Stream Ingest → CV Pipeline (The Watchman) → Evidence Vault
```

## Modules

| Module | Purpose |
|---|---|
| **CDC Connector** | Debezium log-based CDC for read-only database mirroring |
| **Evidence Vault** | SHA-256 hashing + NTP timestamping + Merkle log |
| **Shield UI** | Executive compliance dashboard |
| **The Interpreter** | Arabic Legal-BERT for regulatory NLP |
| **The Watchman** | YOLOv8 computer vision for visual compliance |
| **CFO Savings Hub** | ROI dashboard for intercepted penalties |

## Quick Start

```bash
# Start infrastructure (Kafka, PostgreSQL, etc.)
docker-compose -f infra/docker-compose.yml up -d

# Start the API
cd apps/api && npm install && npm run dev

# Start the Shield UI
cd apps/shield-ui && npm install && npm run dev
```

## Data Sovereignty

All processing and storage resides within Saudi Arabia (STC Cloud). Compliant with PDPL, SDAIA, and NCA standards.

## License

Proprietary — All rights reserved.
