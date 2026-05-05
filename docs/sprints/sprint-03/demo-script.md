# Sprint 3 — Sprint Review (Day 13)

**Duration:** 60 minutes.
**Audience:** PO, PM, Tech Lead, Compliance Officer, CCOSIC SME, candidate-pilot operator, Aerostar (industry partner), STS DevOps liaison (invited for the air-gap segment).
**Facilitator:** will-scrum-master-alpha (lead) with will-scrum-master-bravo for the air-gap and Plugin Info segments.

## Pre-flight (T-30)

- [ ] Stack at tag `sprint-3-review` running.
- [ ] All four track layers populated: `cot-replay`, `mavlink-sim`, `gmti-replay`, `sim-gps-puck`.
- [ ] Browser tabs ready: dashboard (Ops, Admin), tenant-admin, plugin-loader, EMQX, GitLab CI green pipeline.
- [ ] A staged "Brigada 2 Vânători de Munte" tenant carries a terminology override `{"plugin": "modul"}` for the Plugin Info demo.
- [ ] Air-gap rehearsal artefacts ready (bundle manifest, ledger row, optical medium dummy).
- [ ] Backup screencast for each segment.

## Run sheet

### 0:00 — Recap (3 min)
will-scrum-master-alpha: sprint goal in one sentence; what the audience will see.

### 0:03 — STANAG 4607 decoder & encoder (8 min)
Backend TDL:
- Open `plugins/gmti/internal/stanag4607/decoder.go`; explain the WILL minimal profile in one paragraph (header → segments → dwell with fixed mask → target reports).
- Run `go test ./plugins/gmti/...`; show round-trip, fuzz, mask-mismatch tests passing.
- Run a fuzz iteration live for 10 s and show no crashes.

### 0:11 — Synthetic GMTI on the globe (8 min)
Backend Plugins-2 + Frontend APP-6D:
- Open the dashboard. GMTI markers visible near Cincu, distinctive from CoT and MAVLink.
- Each label shows the source plus arrow + radial velocity (e.g., `gmti/RAT-31DL/job7/mti1 → 6.5 m/s`).
- Toggle the GMTI layer off; only GMTI markers disappear. Toggle back on.
- Inject a malformed packet via the lab packet-injector; show a single decode-error log; markers continue to update.

### 0:19 — Track schema extension (4 min)
Backend Core-1:
- `psql -c "select track_kind, count(*) from tracks where observed_at > now() - interval '5 min' group by track_kind"`.
- Show the rows for `gmti`, `cot`, `mavlink`, `point`.
- Reaffirm classification metadata stays in `classification` (ADR-005 unchanged).

### 0:23 — Plugin Info terminology override (4 min)
Frontend Tenant-UX:
- Switch to the Admin view; pick the staged BR2VM tenant; show the terminology JSON `{"plugin": "modul"}`.
- Switch back to Ops; show the Plugin Info panel header reading "Module" (English) / "Modul-uri" (Romanian) instead of "Plugins" / "Plugin-uri".
- Aerostar's Sprint 2 ask (Sprint 3 carry-over #1) is closed.

### 0:27 — ADR-006 walkthrough (4 min)
Tech Lead:
- Open `docs/adr/ADR-006-per-tenant-db-compartments.md`.
- Three modes: shared / schema / compartment. Sprint 4 ships the connectionRouter + RLS; Sprint 11 ORNISS file references this ADR.

### 0:31 — Air-gap mirror procedure rehearsal (10 min)
DevOps On-Prem + Security Engineer:
- Walk the procedure document at section level.
- Show the bundle layout from the rehearsal: `manifest.json`, `images/`, `sboms/`, `sigs/`, `helm/`, `terraform/`, `docs/`, `checksum.txt`.
- Replay the rehearsal log: write step (two-person rule), checksum verification on the classified side, ledger row, smoke test.
- STS DevOps liaison is invited to comment.

### 0:41 — Procurement / interoperability framing (5 min)
will-scrum-master-alpha:
- STANAG 4607 is the first **NATO interoperability standard** WILL implements end-to-end. Direct positioning for **NSPA** (operational acquisition adjacent to ISR), **DIANA sensing track**, **EDF disruptive-tech** sensor calls.
- The air-gap procedure is the operational evidence that the **CPG/STS profile is real**, which is the requirement for any Romanian classified-deployment conversation (and a SAFE eligibility pre-condition once the plugin registry lands in Sprint 12).
- Update the cohort-cycle calendar: DIANA pitch deck draft started Sprint 2 — Sprint 3 outputs go on a slide.

### 0:46 — Acceptance and Q&A (14 min)
PO reads each PBI and accepts/rejects. PM confirms next sprint slot.

## Failure protocol

Same as Sprint 0/1/2.
