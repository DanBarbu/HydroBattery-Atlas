# Sprint 5 — Sprint Plan

**Facilitators:** will-scrum-master-bravo (lead — Bravo + edge), will-scrum-master-alpha (Alpha + DevOps + Cincu)
**Product Owner:** will-product-owner
**Tech Lead:** will-tech-lead
**Sprint window:** [Insert dates at planning]

## 1. Sprint Goal

> An edge K3s deployment runs the WILL edge agent against a local SQLite cache and a command outbox; survives a 30-second WAN partition and drains its outbox on reconnect. The Sprint 3 GMTI decoder is confirmed live at Cincu against a real RAT-31DL emission. The OIDC SSO shim design (ADR-007) is accepted with a Helm-chart placeholder; the OPA Gatekeeper exempt list is parameterised per deployment profile; the annual penetration-test calendar is published.

## 2. Capacity & assignments

Total available 124 person-days. Planned commitment **52 person-days ≈ 36 SP** (work-plan target).

## 3. Sprint Backlog

### S5-01 — Edge SQLite cache (5 SP)
**Owner:** Edge Engineer with Backend Plugins-2.
**Acceptance:**
- `edge/agent/internal/cache/` opens an SQLite file at a configurable path; schema for `tracks` (with `pushed` flag) and `outbox` (with `sent_at`).
- `AppendTrack`, `UnpushedTracks`, `MarkTracksPushed`, `Enqueue`, `Pending`, `MarkSent`, `PendingCount`, `UnpushedCount` implemented and tested.
- Single-writer SQLite (deliberate); concurrency notes documented in package doc.

### S5-02 — Command outbox (8 SP)
**Owner:** Edge Engineer.
**Acceptance:**
- `edge/agent/internal/outbox/` provides `Outbox.Enqueue` with strict input validation (kind, target_id, observed_at).
- JSON payload normalised to a single canonical shape.
- `Resolve(a, b, aLocalID, bLocalID)` implements last-writer-wins with deterministic tie-break.

### S5-03 — Sync service (8 SP)
**Owner:** Backend Plugins-2 (edge client) + Backend Core-1 (core-sync server).
**Acceptance:**
- `edge/agent/internal/sync/` runs an interval loop draining tracks + commands to `core-sync` with at-least-once delivery and idempotent `(edge_id, edge_local_id)` deduplication.
- `services/core-sync/` Go service exposes `/healthz` and `POST /v1/sync/upload`; persists uploads transactionally; sets `app.service_bypass='on'` per transaction so RLS preview does not block.
- V0006 schema adds `edge_nodes` and `edge_commands` tables.
- Unit tests cover happy path, server-500, and the idempotency cases.

### S5-04 — Conflict-resolution policy (5 SP)
**Owner:** Edge Engineer with Tech Lead and Fusion Engineer.
**Acceptance:**
- `docs/edge/conflict-resolution.md` with worked examples and the rationale.
- Policy implemented in `outbox.Resolve` and tested (timestamp + tie-break).
- The Sprint 11 ORNISS file references this document under "tenant boundary, command authority, conflict semantics."

### S5-05 — Disconnected demo (5 SP)
**Owner:** QA Automation.
**Acceptance:**
- `tests/e2e/disconnected-demo.sh` partitions the edge agent from the core for 30 seconds, queues 25 commands during the partition, restores, asserts the outbox drains within 30 seconds.
- Runs on the dev compose without manual intervention.

### S5-06 — Edge install script for K3s (5 SP)
**Owner:** DevOps On-Prem with Edge Engineer.
**Acceptance:**
- `edge/install/install-k3s.sh` installs K3s, applies a Namespace + PV/PVC + Deployment + Service for the edge agent.
- Uses the K3s default `local-path` storage class for the SQLite volume.
- Tested on at least one rugged Linux laptop (Getac S410 or equivalent); `EDGE_ID`, `TENANT_ID`, `CORE_SYNC_URL`, `WILL_VERSION` parameterised.

### S5-07 — RAT-31DL field test at Cincu (8 SP)
**Owner:** QA HIL with Backend TDL.
**Acceptance:**
- `docs/field-tests/sprint-05-rat-31dl-cincu.md` walked through and executed.
- ≥ 95 % packets decoded; vehicle drive-through produces a recognisable GMTI track; radial velocity ±15 % of projection.
- PCAP, screen-recording, logs archived and indexed.
- Decoder benchmark numbers refreshed if the captured PCAP is significantly different from the Sprint 4 capture.

## 4. Sprint 4 retrospective carry-overs

| Carry-over | Owner | Sprint 5 deliverable |
|---|---|---|
| Annual pen-test calendar entry | DevOps On-Prem + Security Engineer | `docs/devops/annual-pentest-calendar.md` with 2026 dates, scope, severity SLA; published to the customer-shared planning tool. |
| SSO shim (OIDC) preview | Backend Core-2 | `docs/adr/ADR-007-sso-shim.md` accepted; `services/tenant-admin/internal/auth/` Binder skeleton + HeaderBinder default. |
| OPA Gatekeeper exempt list per profile | DevOps Cloud + DevOps On-Prem | `helm/values/policy-{cloud,cpg,onprem}.yaml`; cloud profile stays in dry-run, CPG and on-prem flip to enforce after the next quarterly drill (Sprint 6). |

## 5. Out of scope for Sprint 5

- Working OIDC integration — ADR-007 + skeleton only; full implementation Sprint 6.
- NPKI / smart-card auth — Sprint 10.
- Operator workflow to promote GMTI affiliation — Sprint 6 (committed at the Sprint 3 review).
- Fusion engine — Sprint 6.
- HRR (Type 3) STANAG 4607 segments — Sprint 6+.
- Per-tenant DB compartments (`schema` / `compartment`) — Sprint 5/6 trial; Sprint 11 ORNISS evidence.
