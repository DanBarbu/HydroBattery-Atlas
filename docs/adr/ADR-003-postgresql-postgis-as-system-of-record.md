# ADR-003 — PostgreSQL + PostGIS as the system of record

- **Status:** Accepted
- **Date:** Sprint 0
- **Decider:** Tech Lead, with Backend Core-1 and Backend Core-2
- **Consulted:** DevOps Cloud, DevOps On-Prem, Security Engineer

## Context

Tracks, fused tracks, audit events, tenant configuration, and classification labels all need durable storage. The store must support geospatial queries (we display a globe), strong concurrency (10k sensors at 1 Hz target by Sprint 15), partitioning at scale, replication on the cloud profile, and operability on rugged on-prem hardware.

## Decision

We use **PostgreSQL 16 with the PostGIS 3.4 extension** as the single system of record for tracks, audit, and tenant data. **Patroni** provides HA on the cloud and government cloud profiles. **Flyway** owns the schema; migrations are reversible where reasonable (Sprint 0 §7 DoD).

We accept an exception for the immutable audit pipeline: append-only audit events also flow to **WORM MinIO + Loki** (Sprint 11), retaining PostgreSQL as the queryable index but never as the only write target.

## Alternatives considered

- **TimescaleDB on PostgreSQL.** Considered as a future optimisation; not required for Sprint 0–5. Revisit at Sprint 15 stress test.
- **CockroachDB.** Rejected — operational footprint too large for rugged on-prem; PostGIS support weaker.
- **Elasticsearch as primary store.** Rejected — eventual consistency unacceptable for command audit.
- **Mongo + geo plugin.** Rejected — schema flexibility we do not want at the audit layer.

## Consequences

- We commit to schema discipline: Flyway migrations, ADR references in migration headers, indexes deliberate.
- Backups, restore drills, and replication topology are owned by DevOps from Sprint 0.
- The `tracks` table carries a `classification` column from V0001 (S0-03); STANAG 4774 binding lands in Sprint 9 (ADR-005).
- We resist the temptation to push computed views into the database; fusion lives in services, not in SQL.
