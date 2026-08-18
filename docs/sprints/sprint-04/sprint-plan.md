# Sprint 4 — Sprint Plan

**Facilitators:** will-scrum-master-bravo (lead — Charlie + Bravo), will-scrum-master-alpha (Alpha + DevOps)
**Product Owner:** will-product-owner
**Tech Lead:** will-tech-lead
**Sprint window:** [Insert dates at planning]

## 1. Sprint Goal

> 100 LoRa-class IoT sensors flow into WILL via the Plugin SDK pipeline; the tenant admin UI registers them in bulk; tenant-scoped RBAC roles (viewer / operator / admin / auditor / cross_tenant_auditor) gate the Admin and operator-facing APIs; each tenant has a per-tenant key issued by the KMS stub; the "Brigada Demo" tenant ships fully white-labelled and is demonstrable end-to-end; OPA Gatekeeper admission policy applies in dry-run on the cloud profile; the air-gap drill calendar is in the customer-shared planning tool with quarterly entries.

## 2. Capacity & assignments

Total available 124 person-days. Planned commitment **52 person-days ≈ 34 SP** (work-plan target).

## 3. Sprint Backlog

### S4-01 — LoRa MQTT bridge plugin (8 SP)
**Owner:** Backend Plugins-2.
**Acceptance:**
- `plugins/lora-bridge/` Python plugin subscribes to `lorawan/+/uplink` and republishes a v0 Track on `telemetry/lora/<dev>`.
- Tolerates ChirpStack v3 and v4 payload shapes plus the WILL-native sim shape; rejects malformed JSON with a single log line and continues.
- Coords sanity-checked (lat/lon range); silently drops out-of-range.
- `plugins/lora-sim/` Python service publishes `COUNT` synthetic devices.

### S4-02 — Bulk sensor registration UI + API (5 SP)
**Owner:** Backend Core-2 (API), Frontend Tenant-UX (UI).
**Acceptance:**
- `services/tenant-admin/internal/sensors/` package with `BulkRegister` capped at 1 000 entries.
- HTTP routes `GET/POST /v1/tenants/:id/sensors`; transactional bulk insert with `ON CONFLICT DO NOTHING`.
- Frontend `SensorAdmin.tsx` accepts a JSON array; results list refreshes after submit.
- Bilingual (RO/EN); a11y reviewed.

### S4-03 — RBAC schema and middleware (8 SP)
**Owner:** Backend Core-2 (schema + middleware), Frontend Tenant-UX (Members tab).
**Acceptance:**
- V0004 migration adds `users`, `user_role` ENUM, `user_tenants` (PK on (user, tenant, role)), `sensors`.
- Default users (admin / operator / auditor) seeded against the default tenant.
- `internal/rbac/` package: `Allow(role, action)`-style authoriser; HTTP middleware reads `X-Will-Role`.
- Sprint 2 routes preserved (Tenants); Sprint 4 routes (Sensors, Members) gated.
- Frontend `MembersAdmin.tsx` lists, grants, revokes.
- Aerostar's tenant-scoped RBAC ask is closed.

### S4-04 — Per-tenant key-vault entry (KMS stub) (5 SP)
**Owner:** Security Engineer (design), Backend Core-2 (implementation).
**Acceptance:**
- `services/kms-stub/` Go service. `GET /v1/keys/:tenant_id` is idempotent; `POST /v1/keys/:tenant_id/rotate` increments the version.
- 32-byte random key material; in-memory store. The production Vault wrapper (Sprint 10) ships against this same API.
- Compose wires the service; `8082` exposed locally.

### S4-05 — E2E test ingesting 100 LoRa nodes (5 SP)
**Owner:** QA Automation.
**Acceptance:**
- `tests/e2e/lora-100-nodes.sh` subscribes to `telemetry/lora/#`, counts distinct sources within a 12-second window, asserts `>= 100`.
- Runs in CI against the dev compose; documented in the sprint execution log.

### S4-06 — Brigada Demo white-label seed (3 SP)
**Owner:** Tech Writer (content), Backend Core-2 (loader script).
**Acceptance:**
- `db/seeds/brigada-demo.json` carries tenant theme, terminology, features, sensors, memberships.
- `db/seeds/load-brigada-demo.sh` is idempotent; visit shows the BR2VM theme + Romanian terminology.

## 4. Sprint 3 retrospective carry-overs

| Carry-over | Owner | Sprint 4 deliverable |
|---|---|---|
| Air-gap drill calendar | DevOps On-Prem | `docs/devops/air-gap-drill-calendar.md` with 2026 dates, drill-report template, escalation rules. |
| RLS preview | Backend Core-2 | V0005 migration enabling RLS on `tracks` and `sensors` with service-bypass GUC; documented under ADR-006. |
| RAT-31DL PCAP benchmark | Backend TDL | `decoder_bench_test.go` + `docs/benchmarks/sprint-04-rat-31dl-pcap.md`. |

## 5. Other commitments closed this sprint

- **OPA Gatekeeper admission webhook (live, dry-run mode).** ConstraintTemplate + Constraint manifest committed under `policy/gatekeeper-cosign-required.yaml`. Sprint 9 flips to enforce on the on-prem profile.
- **tenant-admin service-bypass GUC.** The tenant-admin binary sets `app.service_bypass=on` at startup so its cross-tenant reads remain functional after V0005; ADR-006 documents this exception.

## 6. Out of scope for Sprint 4

- NPKI / smart-card auth — Sprint 10. Sprint 4 ships role middleware via `X-Will-Role`.
- Vault wiring — Sprint 10. Sprint 4 ships the KMS stub.
- Per-tenant DB compartments (`schema` and `compartment` modes) — Sprint 5/6 trial; Sprint 11 ORNISS evidence.
- Real-radar field test at Cincu — Sprint 5 (PO-approved at Sprint 3).
- Operator workflow to promote GMTI-Unknown → Friendly/Hostile — Sprint 6.
