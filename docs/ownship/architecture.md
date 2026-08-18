# Naval / Own-Ship Module — Architecture

ADR-011. Covers Romanian acquisition #3 (MMPV 90 corvette, Hisar OPV) and
#1 (Rafael SEA-COM communications suite).

## Boundary (read this first)

**WILL integrates the vessel into the federated picture. WILL does not run
the vessel's fight.** The ship's own combat-management system (ADVENT /
SitaWare-class) keeps full authority over the vessel's engagements, weapon
release, and sensor tasking. The `ownship` service neither tasks payloads
nor runs engagements. This is the same coordinator boundary as ADR-008.

## Model

A platform is a **mobile node** with three sub-resources:

| Resource | What it is | Trust |
|---|---|---|
| state | own-ship kinematics + status + EMCON posture | operator (telemetry) |
| comms | Rafael SEA-COM links: VoIP / RoIP / HF / V-UHF / SATCOM, each `UP\|DEGRADED\|DOWN` + latency | operator (telemetry) |
| payloads | mounted sensors + effectors that move with the hull | **admin** (changes BMS pairing) |

```
 vessel (corvette / OPV)                 ownship service
 ┌───────────────────────┐               ┌──────────────────────────┐
 │ CMS owns the fight     │  POST state   │ /v1/platforms             │
 │ (ADVENT/SitaWare-class)│ ─────────────▶│ /v1/platforms/state       │
 │                        │  PUT comms     │ /v1/platforms/{id}/comms  │
 │ SEA-COM suite          │ ─────────────▶│ /v1/platforms/{id}/payloads│
 │ sensors + effectors    │  PUT payloads  │ /v1/platforms/comms-degraded
 └───────────────────────┘               └──────────────┬───────────┘
                                                          ▼
                          federated picture · COA (effectors move with hull)
```

## HTTP surface

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/healthz` | – | liveness |
| GET | `/v1/platforms` | operator | fleet list |
| POST | `/v1/platforms/state` | operator | own-ship kinematic + EMCON report (upsert by `external_id`) |
| GET | `/v1/platforms/comms-degraded` | operator | vessels with any link not `UP` (offline-first / EMCON picture) |
| GET | `/v1/platforms/{id}` | operator | one platform incl. comms + payloads |
| GET/PUT | `/v1/platforms/{id}/comms` | operator | SEA-COM link snapshot |
| GET | `/v1/platforms/{id}/payloads` | operator | mounted payloads |
| PUT | `/v1/platforms/{id}/payloads` | **admin** | declare mounts |

Coordinate range is validated; enums (`hull_class`, `status`,
`emcon_state`) default safely on bad input.

## EMCON & offline-first link

A vessel in **EMCON SILENT** reports SATCOM `DOWN` and HF `DEGRADED`.
`/v1/platforms/comms-degraded` then lists it — the same operational signal
the Sprint-5 edge `outbox`/sync uses. A deployed corvette runs the edge
agent (Sprint 5) **and** reports own-ship state (this module); the two
compose without coupling.

## Hull-mounted effectors → BMS

Effector payloads carry `kind=effector`. The intended wiring (declared in
ADR-011, adapter not yet built) is that these auto-register into the BMS
effectors store with the `platform_id`, so the COA recommender pairs
against them at the ship's **live reported position** rather than a fixed
emplacement. Until then they are visible in the Naval view and the globe
naval layer.

## Demo (ownship-sim)

- **F-Vânătorul** — MMPV 90 corvette, inner patrol box off Constanța.
  Cycles EMCON SILENT (~40 s every ~120 s): SATCOM DOWN, HF DEGRADED,
  status ACTION_STATIONS. Payloads: 3D AESA radar, hull sonar (sensors);
  NSM launcher, 76 mm gun, CIWS, decoy launcher (effectors).
- **P-Bârsa** — Hisar-class OPV, wider outer patrol, comms nominal.
  Payloads: surface-search radar, EO/IR director (sensors); 57 mm gun.

demo-ux **Naval** view shows kinematics, EMCON pill, the SEA-COM link
bar, and the mounted-payload list, with a comms-degraded banner. The
globe **Naval / own-ship** layer draws each vessel (amber when any link
is not UP).
