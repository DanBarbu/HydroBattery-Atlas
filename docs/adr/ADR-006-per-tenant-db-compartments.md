# ADR-006 — Per-tenant DB compartments for high-classification deployments

- **Status:** Accepted
- **Date:** Sprint 3 (Sprint 2 retrospective action)
- **Decider:** Tech Lead, with Backend Core-1, Backend Core-2, Compliance Officer
- **Consulted:** Security Engineer, DevOps Cloud, DevOps On-Prem

## Context

Sprint 2 ships shared-DB / tenant-column isolation: every row carries a `tenant_id`, every query filters on it, and the tenant-admin service enforces the model. This is sufficient for **NATO RESTRICTED** and below.

For **NATO CONFIDENTIAL** and **NATO SECRET** deployments, ORNISS reviewers and NATO accreditation guidance (AC/35-D/2004) require physical or logical separation strong enough that a programming bug in a query cannot expose another tenant's data. A single shared schema will not pass that bar.

## Decision

We introduce a **deployment-time switch** (`tenant_isolation` Helm value) with three values. The data model stays the same; the platform's runtime topology changes.

1. **`shared`** — current Sprint 2 model. Single PostgreSQL database, `tenant_id` column, application-level filtering. Default for unclassified and NATO RESTRICTED.
2. **`schema`** — single PostgreSQL cluster, **one schema per tenant** (`tenant_<slug>`). Application-level routing in the connection pool selects the right schema per request. Suitable for NATO RESTRICTED and (with INFOSEC sign-off) NATO CONFIDENTIAL.
3. **`compartment`** — **one PostgreSQL cluster per tenant**, fronted by per-tenant Patroni (cloud) or a dedicated PG instance (on-prem). The tenant-admin service holds a connection map keyed by tenant id; cross-tenant SQL is structurally impossible. Mandatory for NATO SECRET.

The Helm chart parameterises this. The same WILL Core, Plugin SDK, and tenant-admin service binaries serve all three; only the connection wiring and the deployment topology change.

## Alternatives considered

- **Always per-tenant compartments.** Rejected. Operational cost is unjustified for unclassified pilots; rugged on-prem hosts cannot run dozens of PG instances on one node.
- **Row-level security (RLS) on the shared DB.** Rejected as the sole control for high classification. RLS is a defence-in-depth layer; it is not a substitute for physical isolation when ORNISS asks for compartments. We do plan to enable RLS in Sprint 4 as belt-and-braces for the `shared` and `schema` modes.
- **Per-tenant containers running their own WILL Core fork.** Rejected. Defeats the multi-tenant story; operational nightmare.

## Consequences

- The Sprint 2 schema (V0001 tracks, V0002 tenants, V0003 GMTI extension) survives unchanged. Migrations apply to all three modes.
- The tenant-admin service grows a `connectionRouter` package in Sprint 4 that, given a tenant id and a deployment mode, returns the correct `pgxpool.Pool`. In `shared` mode it returns the singleton; in `schema` mode it issues `SET search_path`; in `compartment` mode it pulls from a per-tenant pool registry.
- Cross-tenant analytics (e.g., "how many GMTI tracks across all tenants this week?") become a deliberate higher-privilege operation that runs on the `shared` or `schema` modes only — and is *not available* in `compartment` mode without a special accreditation.
- DevOps On-Prem owns the `compartment` mode runbook; DevOps Cloud owns the `schema` and `shared` runbooks.
- Sprint 4 RBAC must include the role `cross_tenant_auditor` that gates the cross-tenant query path.

## Verification

- Sprint 4 ships an integration test against `tenant_isolation: schema` proving cross-tenant queries fail.
- Sprint 11 ORNISS pre-accreditation file references this ADR as the documented control for tenant isolation at high classification.
