# Sprint 2 — Sprint Plan

**Facilitators:** will-scrum-master-bravo (Charlie+Bravo lead), will-scrum-master-alpha (Alpha + tenants schema)
**Product Owner:** will-product-owner
**Tech Lead:** will-tech-lead
**Sprint window:** [Insert dates at planning]

---

## 1. Sprint Goal

> A tenant administrator can sign in to the WILL Admin view, edit a JSON theme (primary colour, banner label, affiliation colours), and see the operator view rebrand within 60 seconds — while a MAVLink-equipped UAV (real or `mavlink-sim`) appears on the globe alongside the Sprint 1 ATAK-MIL contacts. All container images shipped this sprint are signed by Cosign in CI.

---

## 2. Capacity

| Engineer | Squad | Days | Notes |
|---|---|---|---|
| Backend Plugins-1 | Bravo | 10 | Cosign signing flow; plugin-loader stress-test review |
| Backend Plugins-2 | Bravo | 10 | MAVLink plugin (S2-03) and `mavlink-sim` |
| Backend Core-1 | Alpha | 10 | tenants migration (S2-01) |
| Backend Core-2 | Alpha | 10 | tenant-admin service (S2-02 backend) |
| Backend TDL | Alpha | 8 | STANAG 4607 spike continues for Sprint 3 |
| Frontend Tenant-UX | Charlie | 10 | Admin UI (S2-02 frontend) |
| Frontend Cesium | Charlie | 10 | Track icon overrides (S2-04) + label collision retro fix |
| Frontend APP-6D | Charlie | 10 | Affiliation override schema; supports retro fix |
| DevOps Cloud | Cross-cutting | 10 | Compose wiring; Cosign CI (S2-05) |
| DevOps On-Prem | Cross-cutting | 5 | Air-gap mirror updates |
| Security Engineer | Cross-cutting | 8 | Cosign keyless flow; tenant-admin auth review |
| QA Automation | Cross-cutting | 10 | tenant-admin integration tests; loader stress |
| QA HIL | Cross-cutting | 6 | MAVLink lab test (Pixhawk on bench) |
| Tech Writer | Cross-cutting | 8 | Theming guide RO/EN (S2-06) |
| Compliance Officer | Cross-cutting | 4 | Plugin matrix update |

**Total available:** 119 person-days. Planned commitment **52 person-days ≈ 32 SP**.

---

## 3. Sprint Backlog

### S2-01 — `tenants` table + tenant-context foundation
**Owner:** Backend Core-1
**Estimate:** 5 SP
**Acceptance:**
- Flyway migration `V0002__tenants.sql` adds `tenants` (id, slug, display_name, theme JSONB, features JSONB, terminology JSONB, timestamps).
- Default tenant seeded with the UUID Sprint 0/1 plugins already use.
- Reversible undo migration committed.
- Compliance Officer approves the schema (theme/terminology JSONB shape is non-classified).

### S2-02 — Tenant admin service + UI
**Owner:** Backend Core-2 (service), Frontend Tenant-UX (UI)
**Estimate:** 8 SP
**Acceptance:**
- `services/tenant-admin/` Go service exposes `/healthz`, `/v1/tenants` (GET, POST), `/v1/tenants/:id` (GET, PATCH, PUT).
- pgx-backed `store` package with table-driven tests; api package with handler tests.
- Frontend `Admin.tsx` lists tenants, allows JSON theme edit, saves with feedback.
- Save-and-reload round-trip exercised in CI E2E test (tagged `sprint-2-e2e`).
- Bilingual (RO/EN) for every visible string.

### S2-03 — MAVLink plugin
**Owner:** Backend Plugins-2
**Estimate:** 8 SP
**Acceptance:**
- `plugins/mavlink/` Python plugin listens on UDP 14550, decodes MAVLink v1/v2 HEARTBEAT and GLOBAL_POSITION_INT.
- Per source system id, accumulates latest position + vehicle type and publishes a v0 Track payload to EMQX once per second.
- `plugins/mavlink-sim/` synthetic generator sends HEARTBEAT + GLOBAL_POSITION_INT in a slow circle over Cincu so demos and CI never depend on a real autopilot.
- Lab test against ArduPilot SITL or a bench Pixhawk passes (S2-03 acceptance includes the test artefact).

### S2-04 — Frontend track type icons configurable per tenant
**Owner:** Frontend Cesium with Frontend APP-6D
**Estimate:** 3 SP
**Acceptance:**
- Globe consumes the active tenant's `theme.affiliationColors` map and applies it to APP-6D affiliation rendering.
- Banner label and background colour driven by `theme.bannerLabel` and `theme.primaryColor`.
- Theme polled every 60 s; admin edits surface within that window.
- Sprint 1 retro action #2 (Cesium label collision) closed: distance-based label visibility and scale; verified with a 30-track stress generator at varying camera altitudes.

### S2-05 — Plugin signing with Cosign in CI
**Owner:** DevOps Cloud + Security Engineer
**Estimate:** 5 SP
**Acceptance:**
- `.gitlab-ci.yml` includes a `sign` stage that signs every WILL container image after the scan stage.
- Keyless OIDC signing on protected runners; key-based fallback for the air-gap profile.
- `policy/cosign-required.rego` skeleton committed for Sprint 4 admission webhook wiring.
- CI on `main` produces signed images with `cosign verify` reproducible locally.

### S2-06 — Theming guide
**Owner:** Tech Writer with Frontend Tenant-UX
**Estimate:** 3 SP
**Acceptance:**
- `docs/admin/theming-guide.md` covers what can and cannot be themed, the Admin UI flow, terminology overrides, feature toggles preview, validation tips.
- Bilingual (RO/EN); reviewed by a Romanian-native engineer.
- Cross-links to ADR-005 (classification metadata is structural, not theming).

---

## 4. Total commitment

| Story | SP |
|---|---|
| S2-01 | 5 |
| S2-02 | 8 |
| S2-03 | 8 |
| S2-04 | 3 |
| S2-05 | 5 |
| S2-06 | 3 |
| **Total** | **32 SP** |

---

## 5. Dependency map

```
S2-01 tenants schema ──> S2-02 tenant-admin (svc + UI) ──┐
                                                         ├─> S2-04 themed globe
                                                         │
S2-03 mavlink plugin ────────────────────────────────────┴─> end-to-end demo
S2-05 cosign signing — independent (touches CI only)
S2-06 theming guide — depends on S2-02 UI shipped
```

Critical path: **S2-01 → S2-02 → S2-04**.

---

## 6. Sprint risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Pixhawk bench logistics slip the lab test | Medium | `mavlink-sim` is the always-available substitute; lab test moves to next available window |
| pgx connection pool exhaustion under admin polling | Low | Pool sized at 8 in dev; HPA tuning Sprint 15 |
| OIDC keyless signing not wired on the GitLab instance | Medium | Key-based fallback documented; `COSIGN_PRIVATE_KEY` variable supported |
| Theme JSON edited to invalid CSS colours blanks the banner | Low | Frontend defaults survive missing/invalid values |
| Sprint 1 carry-overs absorb capacity | Low | Carry-overs sized into individual stories (S2-04 includes label fix) |

---

## 7. Carry-overs from Sprint 1 retrospective (with this sprint's owners)

1. **Loader registry stress-test** — QA Automation + Backend Plugins-1; success measure: `TestStress1000Plugins` and `TestStress1000PluginsConcurrent` pass in CI; List() under 5 ms at 1 000 entries.
2. **Cesium label collision** — Frontend APP-6D + Frontend Cesium; success measure: 30-track stress shows readable labels at all camera altitudes.
3. **NIF teaser one-pager** — will-scrum-master-bravo + Programme Manager; success measure: PM-approved version committed by Day 3.

---

## 8. Out of scope for Sprint 2

- RBAC (roles, permissions, NPKI mapping) — Sprint 4.
- Per-tenant DB compartments (high-classification deployments) — Sprint 3.
- Live OPA Gatekeeper admission webhook — Sprint 4.
- Plugin marketplace UI — Sprint 12.
- Full APP-6D library — Sprint 9.
