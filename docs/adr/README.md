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

## Authoring

- One file per decision. File name format: `ADR-NNN-short-title.md`.
- Status starts as `Proposed`, moves to `Accepted` after Tech Lead review.
- Superseding decisions reference the predecessor in their header.
