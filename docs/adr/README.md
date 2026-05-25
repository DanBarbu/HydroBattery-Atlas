# Architectural Decision Records

We use the [MADR](https://adr.github.io/madr/) format. Each ADR is one durable decision with explicit alternatives and consequences.

## Index

| ID | Title | Status |
|---|---|---|
| [ADR-001](ADR-001-mythic-as-c2-core.md) | Adopt Mythic (forked) as the C2 core | Accepted |
| [ADR-002](ADR-002-grpc-as-plugin-sdk-transport.md) | gRPC as the Plugin SDK transport | Accepted |
| [ADR-003](ADR-003-postgresql-postgis-as-system-of-record.md) | PostgreSQL + PostGIS as the system of record | Accepted |
| [ADR-004](ADR-004-helm-terraform-as-deployment-toolchain.md) | Helm + Terraform as the deployment toolchain | Accepted |
| [ADR-005](ADR-005-stanag-4774-as-canonical-classification.md) | STANAG 4774 as the canonical classification metadata | Accepted |
| [ADR-006](ADR-006-per-tenant-db-compartments.md) | Per-tenant DB compartments for high-classification deployments | Accepted |
| [ADR-007](ADR-007-sso-shim.md) | SSO shim (OIDC) ahead of NPKI | Accepted |
| [ADR-008](ADR-008-bms-module.md) | Battle Management Solution (BMS) module | Accepted |
| [ADR-009](ADR-009-predictive-analysis.md) | Predictive battlefield analysis as a BMS sub-module | Accepted |
| [ADR-010](ADR-010-bft-module.md) | Blue / Friendly Force Tracking (BFT) module | Accepted |
| [ADR-011](ADR-011-ownship-module.md) | Naval / Own-Ship integration as a mobile node | Accepted |
| [ADR-012](ADR-012-fires-coordination-awareness.md) | Fires Coordination Measure awareness (READ-ONLY) | Accepted (co-signed: Tech Lead · Compliance · Security) |
| [ADR-013](ADR-013-training-module.md) | War-games Training module (EXERCISE-isolated) | Accepted (co-signed: Tech Lead · Compliance) |
| [ADR-014](ADR-014-legacy-c2-bridge.md) | Legacy C2 Bridge — BC2A® / ICIS interoperability | Accepted (co-signed: Tech Lead · Compliance) |
| [ADR-015](ADR-015-metoc-module.md) | METOC module — weather impact + Lagrangian drift (advisory) | Accepted (co-signed: Tech Lead · Compliance) |
| [ADR-016](ADR-016-osint-module.md) | OSINT module — ADS-B / AIS / TLE / hazards (advisory, low-confidence) | Accepted (co-signed: Tech Lead · Compliance · Security) |

## Authoring

- One file per decision. File name format: `ADR-NNN-short-title.md`.
- Status starts as `Proposed`, moves to `Accepted` after Tech Lead review.
- Superseding decisions reference the predecessor in their header.
