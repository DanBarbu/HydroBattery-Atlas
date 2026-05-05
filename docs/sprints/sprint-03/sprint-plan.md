# Sprint 3 — Sprint Plan

**Facilitators:** will-scrum-master-alpha (lead — TDL focus), will-scrum-master-bravo (Charlie + air-gap)
**Product Owner:** will-product-owner
**Tech Lead:** will-tech-lead
**Sprint window:** [Insert dates at planning]

---

## 1. Sprint Goal

> A STANAG 4607 GMTI feed appears on the WILL globe with distinctive symbology and a directional radial-velocity label, alongside the Sprint 1 ATAK-MIL CoT contacts and the Sprint 2 MAVLink UAV. The Plugin Info panel applies the active tenant's terminology overrides. ADR-006 records the per-tenant DB compartment design. The air-gap mirror procedure is documented, signed off, and rehearsed.

---

## 2. Capacity

| Engineer | Squad | Days | Notes |
|---|---|---|---|
| Backend TDL | Alpha | 10 | STANAG 4607 decoder + encoder + plugin (S3-01, S3-02) |
| Backend Plugins-2 | Bravo | 10 | gmti-replay synthetic generator (S3-04) |
| Backend Core-1 | Alpha | 10 | tracks schema extension (S3-03) |
| Backend Core-2 | Alpha | 8 | ADR-006 review; RLS preview for Sprint 4 |
| Backend Plugins-1 | Bravo | 8 | Cross-pair on encoder; Plugin SDK contract review |
| Frontend APP-6D | Charlie | 10 | GMTI symbology in Globe.tsx (S3-05) |
| Frontend Cesium | Charlie | 10 | Layer toggle UX |
| Frontend Tenant-UX | Charlie | 10 | Terminology overrides in Plugin Info (carry-over) |
| DevOps Cloud | Cross-cutting | 8 | Compose wiring; CI updates |
| DevOps On-Prem | Cross-cutting | 10 | Air-gap mirror procedure (carry-over) — owns it |
| Security Engineer | Cross-cutting | 8 | Air-gap procedure review; ADR-006 review |
| QA Automation | Cross-cutting | 10 | gmti decoder tests; round-trip; fuzz |
| QA HIL | Cross-cutting | 8 | GMTI lab field test |
| Tech Writer | Cross-cutting | 8 | Air-gap procedure RO summary; ADR-006 polish; field-test write-up |
| Compliance Officer | Cross-cutting | 6 | Air-gap procedure dual-use review; classification of GMTI plugin |

**Total available:** 124 person-days. Planned commitment **52 person-days ≈ 34 SP**.

---

## 3. Sprint Backlog

### S3-01 — STANAG 4607 binary parser
**Owner:** Backend TDL (with Backend Plugins-1 cross-pair)
**Estimate:** 13 SP
**Acceptance:**
- `plugins/gmti/internal/stanag4607/` decodes packet header, Mission segment (Type 1), Dwell segment (Type 2) with the WILL minimal profile existence mask.
- Companion encoder produces packets the decoder reads back round-trip.
- Hostile inputs do not crash: oversize, truncated, bad PacketID, bad segment size, mismatched ExistenceMask.
- Unsupported segment types are skipped with their declared size honoured.
- `FuzzDecode` runs in CI for 30 s/PR.
- The "WILL minimal profile" is documented at the package level and referenced from this sprint plan and from the Tech Writer's docs.

### S3-02 — GMTI plugin
**Owner:** Backend TDL
**Estimate:** 8 SP
**Acceptance:**
- `plugins/gmti/cmd/gmti` listens UDP `0.0.0.0:8190`, decodes packets, transforms each target report via `internal/forward` into a v0 Track with `track_kind=gmti`, `velocity_radial_mps`, `snr_db`, and a metadata block carrying platform/job/dwell indices.
- Publishes per packet to EMQX `telemetry/gmti/job<jobid>`.
- Survives malformed and mask-mismatch packets with a clear log line and continues.
- Compose wiring includes the plugin and a synthetic generator container.

### S3-03 — Track table schema extension
**Owner:** Backend Core-1
**Estimate:** 3 SP
**Acceptance:**
- V0003 migration adds `track_kind`, `velocity_radial_mps`, `snr_db`, `gmti_job_id`, `gmti_mti_report_index`.
- Compound index `(track_kind, observed_at DESC)`.
- Reversible undo migration.
- ADR-005 STANAG 4774 column unaffected.
- Compliance Officer approves.

### S3-04 — Field test with radar simulator
**Owner:** Backend Plugins-2 (synth generator), QA HIL (test execution)
**Estimate:** 5 SP
**Acceptance:**
- `plugins/gmti-replay/` Go service emits a STANAG 4607 packet every second containing 3 target reports near the Cincu range.
- Field-test plan written: `docs/field-tests/sprint-03-gmti.md`.
- Plan executed in the lab Faraday cage; PCAP and screen-recording captured.
- Pass criteria from the test plan met.

### S3-05 — Frontend GMTI symbology layer
**Owner:** Frontend APP-6D + Frontend Cesium
**Estimate:** 5 SP
**Acceptance:**
- GMTI markers render distinctively (smaller point with thicker outline; default Unknown-affiliation yellow per APP-6D).
- Per-track label includes a directional arrow and the radial velocity in m/s.
- Layer toggle row shows Point / CoT / MAVLink / GMTI checkboxes; toggling hides/reveals only the selected family.
- Bilingual layer labels; Lighthouse a11y on the Ops view ≥ 95.

---

## 4. Total commitment

| Story | SP |
|---|---|
| S3-01 | 13 |
| S3-02 | 8 |
| S3-03 | 3 |
| S3-04 | 5 |
| S3-05 | 5 |
| **Total** | **34 SP** |

---

## 5. Sprint risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Real RAT-31DL access at Cincu does not align with the sprint window | High | The synthetic `gmti-replay` is the contracted substitute; real-radar test slips to Sprint 4/5 with PO approval |
| Existence-mask interpretation drifts as we read more sample data | Medium | The WILL minimal profile is documented and the decoder rejects mask mismatches loudly; iteration in later sprints widens the profile additively |
| GMTI label collision with dense ATAK-MIL contacts | Low | Sprint 2 distance-based label fix already covers this; QA Automation runs the 30-track stress with all four layers on |
| Air-gap procedure rehearsal slips | Low | Rehearsal scheduled Day 9; if STS POC unavailable, dry-run with Compliance Officer as proxy |

---

## 6. Carry-overs from Sprint 2 retrospective (with this sprint's owners)

1. **Tenant terminology overrides applied to Plugin Info panel** — Frontend Tenant-UX; success measure: a tenant-set terminology of `{"plugin": "modul"}` renders "Modul-uri" / "Module" in the panel header consistently.
2. **Per-tenant DB compartment design ADR (ADR-006)** — Tech Lead; success measure: ADR-006 accepted by end of Sprint 3 Day 5.
3. **Air-gap mirror procedure for new images** — DevOps On-Prem; success measure: procedure document accepted by Security Engineer + Compliance Officer; rehearsal completed by Day 11.

---

## 7. Out of scope for Sprint 3

- HRR (High Range Resolution) segments — Sprint 6+.
- Free-text and Job Definition segments — Sprint 6+.
- Real-time SNR-based fusion — Sprint 6.
- Operator workflow to promote GMTI affiliation Unknown → Friendly/Hostile — Sprint 4 ships the role; Sprint 6 ships the workflow.
- RBAC roles and NPKI auth — Sprint 4.
- OPA Gatekeeper admission webhook live — Sprint 4.
