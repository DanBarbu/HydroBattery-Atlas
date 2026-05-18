# Romanian Defence Acquisition → WILL Integration Analysis

> Owner: will-tech-lead with will-product-owner, will-scrum-master-alpha,
> will-scrum-master-bravo, will-compliance-officer.
> Source list: 20-year compilation of Romanian MoD acquisitions (provided).
> Purpose: decide, per programme, whether WILL needs an **update** to an
> existing capability or a **new dedicated module**, and in what order.

## Method

Each programme is mapped to what WILL models today (Plugin SDK
`will.sensor.v1` / `will.effector.v1`, the BMS module's effector kinds and
scoring, the TDL roadmap, the edge comms abstraction). Verdict is one of:

- **UPDATE** — WILL already has the abstraction; needs a real plugin,
  real parameters, or a config/inventory refresh.
- **NEW MODULE** — WILL has no abstraction for this asset class.
- **NO PLATFORM ACTION** — relevant to procurement strategy, not to the
  software (still captured by the Scrum Masters' procurement overlay).

## Per-programme mapping

| # | Programme (year) | WILL coverage today | Verdict | Target in WILL | Procurement track |
|---|---|---|---|---|---|
| 1 | Rafael SEA-COM naval comms (2023) | Generic HF/SATCOM edge bridge (Sprint 8, roadmap) | **UPDATE** | Comms abstraction + a `naval-comms` adapter plugin (VoIP/RoIP/HF/V-UHF/Satcom presence + link health into the COP) | FMS-adjacent (ISR) |
| 2 | NSM Coastal Defence (2023) | BMS `nsm_coastal` effector kind; "NSM Coastal Bty" seeded | **UPDATE** | Real `nsm-coastal` effector plugin + correct envelope (range/altitude/speed) and salvo inventory | FMS (Raytheon) |
| 3 | MMPV 90 Corvette / Hisar OPV (2025–26) | None — no own-ship / vessel concept | **NEW MODULE** | **Naval / Own-Ship Combat Management integration** (vessel as a tenant-scoped mobile node carrying its own sensors + effectors) | **SAFE** (Rheinmetall/NVL, Mangalia) + ASFAT |
| 4 | Watchkeeper X Tactical UAS (2022) | MAVLink plugin (UAV); `gmti` (STANAG 4607) for its ISTAR radar | **UPDATE** | STANAG 4586 UCS plugin (Watchkeeper does not speak MAVLink); reuse the existing `gmti` decoder for its GMTI product | Framework (Elbit) |
| 5 | F-16 fleet (2024–25) | TDL roadmap: Link-16 (Sprint 8) | **UPDATE** | Link-16 / STANAG 5516 gateway; F-16 appears as friendly air via PPLI | Donation/transfer + FMS munitions |
| 6 | F-16 munitions — AIM-120, AIM-9X, GBU-39B (2024–25) | None — no air-intercept effector kind | **NEW (BMS effector kind)** | BMS `air_intercept` effector kind; a CAP fighter is an effector with an AAM inventory | FMS |
| 7 | F-35A (2023–24) | TDL roadmap: Link-16 | **UPDATE** | Link-16 ingest; MADL is closed — document the boundary; F-35 as a high-value sensor/effector node | FMS (non-SAFE) |
| 8 | Patriot (2017–25) | BMS `sam_area`; `sam-battery-mock` plugin; "Patriot Bn 1" seeded | **UPDATE** | Real `patriot` effector plugin; PAC-3 MSE vs GEM-T inventory; Config 3+ radar; correct envelope | FMS (non-SAFE) |
| 9 | Patriot replacement post-donation (2025) | Same as #8 | **UPDATE** | Inventory/config delta only (one extra radar set + launchers) | FMS |
| 10 | Skynex / Oerlikon GDF 103 (2023) | BMS `sam_point` / `c_uas`; `gmti` radar | **UPDATE** | New `gun_shorad` effector kind (or map to `sam_point`); Skymaster fire-control adapter; the 3D acquisition radar as a sensor plugin | EU (Rheinmetall) |
| 11 | US C-UAS marketplace / JIATF-401 (2026) | BMS `c_uas`; plugin registry (Sprint 12, roadmap) | **UPDATE** | C-UAS plugin family + alignment of the plugin registry with the JIATF-401 payload catalogue | FMS marketplace |
| 12 | Rheinmetall Lynx KF41 IFV (2026) | CoT via ATAK-MIL only — no dedicated friendly-asset model | **NEW MODULE** | **Blue / Friendly Force Tracking (BFT)** | **SAFE** (Rheinmetall, Mediaș) |
| 13 | M1A2 Abrams MBT (2023) | CoT via ATAK-MIL only | **NEW MODULE** | **Blue / Friendly Force Tracking (BFT)** | FMS (non-SAFE) |
| 14 | Otokar Cobra II 4x4 (2024–26) | CoT via ATAK-MIL only | **NEW MODULE** | **Blue / Friendly Force Tracking (BFT)** | Tender (Otokar) |
| 15 | M142 HIMARS (2017–18) | None — offensive fires, **outside ADR-008 coordinator scope** | **NEW MODULE (bounded)** | **Fires Coordination (FSCM) awareness** — fire-support coordination measures + fire-mission status awareness ONLY; never fire control | FMS (non-SAFE) |
| 16 | Piranha III / V (2006–17) | CoT via ATAK-MIL only | **NEW MODULE** | **Blue / Friendly Force Tracking (BFT)** | EU (GDELS) |

## Synthesis — four candidate dedicated modules

### A. Blue / Friendly Force Tracking (BFT) — covers #12, #13, #14, #16 (+ complements #5, #7)
The single biggest gap. Four major land programmes (Lynx, Abrams, Cobra II,
Piranha) and the friendly air picture (F-16/F-35) have **no first-class
representation** today — they only appear if someone runs ATAK on them.
Doctrine-standard: NFFI, Friendly Force Information (FFI), VMF, Link-16
PPLI, STANAG 5527. No ADR-008 boundary risk (purely situational
awareness). **Highest asset coverage, lowest risk.**

### B. Air-Defence effector expansion — covers #2, #6, #8, #9, #10 (mostly UPDATE)
Add the `air_intercept` effector kind (F-16/F-35 + AIM-120/AIM-9X), add a
`gun_shorad` kind (Skynex), and refresh real envelopes/inventories for
NSM and Patriot. Mostly BMS updates plus one or two effector kinds — fast,
high demo value, slots straight into the existing BMS/COA/predictive
pipeline.

### C. Naval / Own-Ship Combat Management integration — covers #3 (+ #1)
A vessel (MMPV 90 corvette, Hisar OPV) is a **mobile tenant node** that
itself carries sensors and effectors and a comms suite (Rafael SEA-COM).
WILL has no own-ship/platform concept. Larger design effort; needs an
ADR (own-ship as a moving multi-tenant edge node). **SAFE-funded** — high
procurement leverage.

### D. Fires Coordination (FSCM) awareness — covers #15 (HIMARS)
Sensitive. WILL is a coordinator, not a fire-control system (ADR-008).
HIMARS is offensive fires. The only defensible scope is **awareness of
fire-support coordination measures** (FSCZ, NFA, RFA, ACA) and **fire-
mission status** ingested read-only — never tasking or fire control.
Requires a new ADR co-signed by Tech Lead + Compliance Officer + Security
Engineer before any code.

## Delivery status

- **A — Blue/Friendly Force Tracking:** delivered (ADR-010,
  `services/bft`, `docs/bft/architecture.md`).
- **B — Air-Defence effector expansion:** delivered (extends ADR-008,
  `docs/bms/air-defence-expansion.md`) — `air_intercept` + `gun_shorad`
  kinds, Patriot/NSM envelope refresh, Patriot ballistic-intercept
  compatibility.
- **C — Naval / Own-Ship integration:** delivered (ADR-011,
  `services/ownship`, `docs/ownship/architecture.md`) — vessel as a
  mobile node: own-ship state + EMCON, Rafael SEA-COM link health,
  hull-mounted payload registry.
- **D — Fires Coordination awareness:** pending (needs ADR).

## Recommended build order

1. **A — Blue/Friendly Force Tracking module.** Most assets, genuine gap,
   doctrine-standard, zero boundary risk. Build first.
2. **B — Air-Defence effector expansion.** Mostly BMS updates + two
   effector kinds; fast; immediately visible in the BMS/COA/predictive
   demo. Build second (can run in parallel with A — different squad).
3. **C — Naval / Own-Ship integration.** SAFE-funded, high leverage, but
   needs an ADR and is a larger design. Build third.
4. **D — Fires Coordination awareness.** Build last and only after an
   ADR explicitly bounds it to read-only coordination-measure awareness.

## Procurement overlay note (Scrum Masters)

SAFE-funded programmes (#3 MMPV 90 corvette, #12 Lynx KF41) are the ones
where WILL's Bill-of-Origin process (Sprint 12 plugin registry) matters
most for the customer's funding eligibility. The BFT and Naval modules
therefore carry the strongest procurement leverage; the procurement
classification matrix must tag their plugins on day one.

## What needs NO platform action (procurement-only)

None of the 16 are pure no-ops, but the F-16/F-35 munitions (#6) and the
C-UAS marketplace (#11) are mostly **catalogue / inventory** items — they
are handled by configuration and the plugin registry rather than new
platform abstractions, once the `air_intercept` and `c_uas` kinds exist.
