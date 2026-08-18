# Sprint 4 — Sprint Review (Day 13)

**Duration:** 60 minutes.
**Audience:** PO, PM, Tech Lead, Compliance Officer, CCOSIC SME, Aerostar, STS DevOps liaison, candidate-pilot operator.
**Facilitator:** will-scrum-master-bravo (lead) with will-scrum-master-alpha for the RBAC + air-gap segments.

## Pre-flight (T-30)

- [ ] Stack at tag `sprint-4-review` running.
- [ ] All five generators running: `cot-replay`, `mavlink-sim`, `gmti-replay`, `lora-sim` (COUNT=100), `sim-gps-puck`.
- [ ] Brigada Demo tenant seeded (`./db/seeds/load-brigada-demo.sh`).
- [ ] Browser tabs ready: dashboard (Ops + Admin), tenant-admin, plugin-loader, kms-stub, EMQX dashboard.
- [ ] OPA Gatekeeper dry-run logs visible on the cloud-profile staging cluster.

## Run sheet

### 0:00 — Recap (3 min)
will-scrum-master-bravo: sprint goal in one sentence; what the audience will see.

### 0:03 — 100 LoRa nodes on the globe (8 min)
Backend Plugins-2 + Frontend Cesium:
- Open the dashboard. Layer toggle: **Point** on, others off. Show ~100 yellow dots scattered around Cincu.
- `docker compose logs --tail=20 lora-sim` shows uplinks; `lora-bridge` shows the bridge.
- Run `tests/e2e/lora-100-nodes.sh` live; PASS line on screen.

### 0:11 — Brigada Demo white-label (8 min)
Frontend Tenant-UX:
- Re-run `load-brigada-demo.sh` to show idempotency.
- Switch to **Admin** → BR2VM-Demo → **Theme** tab; show the brigade green and the "BR2VM — INSTRUIRE" banner.
- **Sensors** tab: bulk-register two more sensors via the JSON editor; show the registered list refresh.
- **Members** tab: grant `auditor` to a new UUID; show the list refresh.
- Back to **Operations**: terminology override `plugin → modul` visible in the Plugin Info panel header.

### 0:19 — RBAC enforcement (6 min)
Backend Core-2:
- `curl -H 'X-Will-Role: viewer' .../v1/tenants` → 403.
- `curl -H 'X-Will-Role: admin' .../v1/tenants` → 200 list.
- `curl -H 'X-Will-Role: operator' -X POST .../v1/tenants/<id>/sensors` → 403.
- `curl -H 'X-Will-Role: admin' -X POST .../v1/tenants/<id>/sensors` → 201 with the bulk array.

### 0:25 — KMS stub (4 min)
Security Engineer:
- `curl http://localhost:8082/v1/keys/<tenant>` returns version 1 (idempotent).
- `curl -X POST http://localhost:8082/v1/keys/<tenant>/rotate` returns version 2.
- Open the stub source at the API package; reaffirm Sprint 10 swaps the implementation for Vault without touching this surface.

### 0:29 — RLS preview + service-bypass (5 min)
Backend Core-2:
- In `psql`: `SET app.current_tenant_id = '<tenant-A>'; SELECT count(*) FROM tracks;` returns the tenant-A count.
- Set tenant-B; show the count differs.
- `SET app.current_role = 'cross_tenant_auditor';` → cross-tenant read works.
- Open ADR-006 to walk the boundary between application-layer and database-layer enforcement.

### 0:34 — Air-gap drill calendar (4 min)
DevOps On-Prem:
- Open `docs/devops/air-gap-drill-calendar.md`; walk the 2026 quarterly entries.
- Show the drill-report template and the failure-mode escalation rules.
- STS DevOps liaison invited to comment.

### 0:38 — OPA Gatekeeper admission webhook (3 min)
DevOps Cloud:
- Show the ConstraintTemplate applied on the staging cluster.
- Tail Gatekeeper logs while attempting to schedule a Pod with an unsigned image; show the **dry-run violation** entry. Sprint 9 flips this to enforce.

### 0:41 — RAT-31DL benchmark (3 min)
Backend TDL:
- Show the recorded numbers from `docs/benchmarks/sprint-04-rat-31dl-pcap.md`.
- ~5.7 GB/s throughput on the live capture; zero decode errors; HRR segment skipped as designed.

### 0:44 — Procurement / interoperability framing (4 min)
will-scrum-master-bravo:
- LoRa + RBAC + multi-tenant theming = the **EDIRPA joint-procurement story** is now demonstrable.
- 100-node E2E + bulk registration = a credible **DIANA sensing track** demo.
- KMS stub + RLS preview + air-gap drill calendar + Gatekeeper dry-run = **ORNISS pre-accreditation evidence pack** beginning to take real shape (Sprint 11 deliverable).
- Cohort-cycle calendar refreshed; PM circulating the updated DIANA pitch deck.

### 0:48 — Acceptance and Q&A (12 min)
PO reads each PBI and accepts/rejects. PM confirms next sprint slot.
