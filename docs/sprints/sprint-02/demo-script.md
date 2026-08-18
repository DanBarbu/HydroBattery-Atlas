# Sprint 2 — Sprint Review (Day 13)

**Duration:** 60 minutes.
**Audience:** PO, PM, Tech Lead, Compliance Officer (optional), CCOSIC SME, one operator from a candidate pilot unit, one industry-partner integrator (invited via PM).
**Facilitator:** will-scrum-master-bravo (lead) with will-scrum-master-alpha for the schema and Cosign segments.

## Pre-flight (T-30)

- [ ] Stack at tag `sprint-2-review` running.
- [ ] `cot-replay` and `mavlink-sim` running so the demo has guaranteed traffic from Sprint 1 + Sprint 2 sources.
- [ ] Browser tabs ready: dashboard (Ops), dashboard (Admin), tenant-admin `/v1/tenants`, plugin-loader `/v1/plugins`, EMQX dashboard, GitLab CI green pipeline showing the `sign` stage with cosign output.
- [ ] One pre-staged "Brigada 2 Vânători de Munte" tenant already created in the dev DB so the demo can start from "edit" rather than "create".
- [ ] Backup screencast for each major segment.

## Run sheet

### 0:00 — Recap (3 min)
will-scrum-master-bravo: sprint goal in one sentence; what the audience will see.

### 0:03 — Tenants schema and the default tenant (4 min)
Backend Core-1: open V0002 migration; show the `tenants` row for the default tenant. Highlight the JSONB columns; reaffirm classification metadata is *not* in `theme` (ADR-005).

### 0:07 — Live rebrand (10 min)
Frontend Tenant-UX:
- Sign in to the dashboard. Click **Admin**.
- Pick "Brigada 2 Vânători de Munte" from the left list.
- Edit `primaryColor` to a brigade green; edit `bannerLabel` to "BR2VM — INSTRUIRE"; press **Save**.
- Switch back to **Operations**. Banner colour and label updated immediately on reload (or within the 60 s poll).
- Edit `affiliationColors.F` to a different blue; save; show change on the next poll.

### 0:17 — MAVLink UAV on the globe (8 min)
Backend Plugins-2:
- Open the dashboard. Show the MAVLink contact (sysid 1) circling Cincu.
- `docker compose logs mavlink-sim` shows HEARTBEAT + GLOBAL_POSITION_INT being sent.
- `docker compose logs mavlink` shows the Track payload published to EMQX.
- Stop `mavlink-sim` for 5 seconds; the icon goes stale; restart; show recovery.
- Switch to the bench Pixhawk if available; show same pipeline with a real autopilot.

### 0:25 — Plugin Info panel + Cosign signature (6 min)
Backend Plugins-1: in the Plugin Info panel, show `mavlink` and `atak-mil` both `SERVING`. Open GitLab CI: walk the `sign` stage output; run `cosign verify` against one of the published images.

### 0:31 — Cesium label collision retro fix (3 min)
Frontend APP-6D: zoom out from Cincu altitude to global view; show labels disappear past 250 km eye altitude and shrink gracefully between 2 km and 50 km. Spawn a 30-track stress generator to demonstrate readability.

### 0:34 — Procurement / interoperability framing (4 min)
will-scrum-master-bravo:
- White-label admin = the EDIRPA hook (multi-MS shared C2 with isolated tenants).
- MAVLink plugin = direct fit for the DIANA "autonomy" track and the NIF "dual-use deep tech" thesis.
- Cosign signing in CI = Bill of Origin foundation that SAFE eligibility (Sprint 12) needs.
- Open `docs/programme/nif-teaser-onepager.md` and reference the PM-approved version.

### 0:38 — Theming guide (3 min)
Tech Writer: open the bilingual theming guide; click the Romanian section.

### 0:41 — Loader stress-test result (2 min)
QA Automation: run `go test -run TestStress -v ./internal/registry`; show List() latency under 5 ms at 1 000 entries.

### 0:43 — Acceptance and Q&A (12 min)
PO reads each PBI and accepts/rejects. PM confirms next sprint slot.

## Failure protocol

Same as Sprint 0/1: keep talking, switch to backup screencast, file P1 bug, root-cause before Sprint 3 planning.
