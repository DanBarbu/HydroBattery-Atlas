# BMS Module Extensions

> Six capability additions inspired by publicly-documented battle-management
> platforms (Sita-Ware, ADVENT, Fortion IBMS, SBMS) and the Anduril press
> release referenced in [ADR-008](../adr/ADR-008-bms-module.md). Built from
> public information only; no proprietary code or designs were used.

## Alignment matrix

| Public BMS capability area | What WILL adds | Where |
|---|---|---|
| Common operating picture, secure | Classification banner + STANAG 4774 metadata column | Sprint 0 + 9 |
| Sensor & platform integration | Plugin SDK (`will.sensor.v1`, `will.effector.v1`) | Sprints 1, ADR-008 |
| Automated decision support | Threat scoring + weapon-target pairing + COA recommender | ADR-008 + this doc |
| Defended Asset List, engagement zones | `defended_assets`, `engagement_zones` schema + `/v1/defended-assets` + `/v1/engagement-zones` | This doc |
| Predicted intercept geometry | `prediction.Propagate` + intercept overlay on globe | This doc |
| Kill-chain (F2T2EA) timing | `engagements.timeline` JSONB + `/v1/engagements/:id/timeline` | This doc |
| Time-Sensitive Target lane | `engagements.is_tst` + `/v1/engagements/tst-approve` + abbreviated UI | This doc |
| After-Action Review | `/v1/engagements/:id/aar` returning a signed-export-ready pack | This doc |
| Resilient PNT awareness | `pnt_status` + `rf_environment` columns + score haircut | This doc |
| Interoperability (Link 11/16/22, MIP 4) | Sprint 1 ATAK-MIL CoT, Sprint 8 Link-16/22 (planned) | Roadmap |
| Scalability dismounted → HQ | Sprint 5 K3s edge runtime + offline-first sync | Sprint 5 |
| Predictive battlefield analysis | Track propagation, engagement windows, COA — see [`predictive-analysis.md`](predictive-analysis.md) | This release |

## 1. Defended Asset List (DAL) and Engagement Zones (EZ)

- **Schema** — V0008 adds `defended_assets` (lat/lon/criticality 1–5) and
  `engagement_zones` (GeoJSON polygon, kind one of WEZ/HIDACZ/JEZ/MEZ/FEZ/ROZ).
- **API** — `GET/POST /v1/defended-assets`, `GET/POST /v1/engagement-zones`.
  Operator can read; admin can register.
- **Scoring impact** — every threat score consults the DAL for the
  `proximity` and `heading` components.
- **UI** — DAL pins (orange ★) and EZ polygons on the globe; toggleable.

## 2. Predicted intercept geometry

- **Engine** — `prediction.Propagate` produces 12 waypoints across a
  120-second horizon (10 s steps) using the track's heading and speed.
  Uncertainty grows linearly: 1-σ at observation + 3 m/s² thereafter.
- **UI** — Each hostile/unknown threat draws a dotted projected path on
  the globe with a 3-σ uncertainty marker at the horizon. Each EXECUTING
  engagement draws a blue line from the effector to the predicted impact.
- **API** — `GET /v1/predictions/tracks` (per-tenant projection set);
  `GET /v1/predictions/engagement-windows` (when does each track sit
  inside each effector's envelope?).

## 3. Kill-chain timing (F2T2EA)

- **Schema** — `engagements.timeline JSONB` with optional RFC 3339 stamps
  for `find`, `fix`, `track`, `target`, `engage`, `assess`. The BMS
  populates `find/fix/track` from the threat's `observed_at`, `target` on
  propose, `engage` on approve, `assess` on complete/abort/reject.
- **API** — `GET /v1/engagements/:id/timeline` returns stamps + computed
  inter-phase durations.
- **UI** — Six-cell strip on every engagement card; cells light up green
  as their phase is reached.

## 4. Time-Sensitive Target (TST) fast lane

- **Logic** — `tst.IsTST(input)` qualifies a threat when EITHER its
  `priority_score >= 0.75` OR its class is in `{ballistic, cruise, swarm}`
  AND time-to-defended-asset ≤ 30 s.
- **API** — `POST /v1/engagements/tst-approve` proposes + approves in one
  step. ADR-008's operator-authority gate is preserved (the click is the
  operator authority); the gate is faster, not absent.
- **UI** — Red `TST` badge on qualifying threats; `⚡ TST Approve` button
  combines propose+approve.

## 5. After-Action Review (AAR)

- **API** — `GET /v1/engagements/:id/aar` returns a single JSON pack with:
  final status, TST flag, F2T2EA stamps, computed durations, PK,
  time-to-intercept, the threat-scoring rationale used at the time, and
  free-text notes. Auditor role required.
- **UI** — `AAR` button on COMPLETED/ABORTED/REJECTED engagements opens a
  modal with the same content human-formatted. Stub for the eIDAS-2
  signed export that Sprint 11 ORNISS work formalises.

## 6. Resilient PNT awareness

- **Schema** — `pnt_status` and `rf_environment` columns on both `tracks`
  and `effectors` (`NOMINAL`, `DEGRADED`, `DENIED`, `SPOOFED_SUSPECTED`).
- **Score impact** — DEGRADED reduces priority score by 8 %, DENIED /
  SPOOFED_SUSPECTED by 20 %. The rationale block records the haircut.
- **UI** — Yellow / red / purple badges on threats. A single-click button
  in the BMS toolbar simulates GNSS denial for UAV-class threats.

---

## What none of these do

- They do not move WILL into fire-control. `EXECUTING` is gated by the
  operator approval step; `COMPLETED` is gated by an effector report.
  ADR-008's coordinator boundary stands.
- They do not run a full multi-target tracking filter; that is the
  Sprint 6 fusion engine's job. The BMS's prediction is a coarse
  forward-propagation suitable for situation awareness and engagement
  windowing.
- They do not consume classified GNSS-jamming attribution data. PNT
  status is a tenant-supplied flag at the moment; integrators wire it
  to their resilient-PNT sources (Galileo OSNMA, eLoran, multi-GNSS
  fusion) on a per-deployment basis.
