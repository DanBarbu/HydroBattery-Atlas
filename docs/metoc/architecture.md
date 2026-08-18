# METOC Module — Architecture

ADR-015. Meteorology & Oceanography decision-support for the WILL common
operating picture, including **Lagrangian (parcel-drift) forecasting**.
**Advisory only — not tasking, not fire control.**

## The boundary (read this first)

WILL is a coordinator and decision-aid (ADR-008). METOC answers two
questions and nothing more:

1. *Operational impact* — given the weather/sea state, is a given asset
   class **GO / CAUTION / NO_GO**?
2. *Drift* — given a flow field, where will a drifting object (a
   man-overboard datum, a spill marker, a low-cost floating sensor) **go**?

### Prohibited — no endpoint, no code path, no schema column

- task / launch / recall / command any asset, sortie, or effector
- write back to any sensor or weather provider
- turn a drift prediction into a dispatch ("go put a sensor there")
- gate, block, or approve another module's action

The GO/CAUTION/NO_GO matrix and the drift forecast are **inputs to the
operator**, never actions. `api_test.go::TestNoTaskingRoutes` asserts the
tasking-style routes do not exist; the impact and drift responses carry
`advisory_only: true`.

## Provider-adapter design

METOC does not bind to one weather product. Any platform — METAR/TAF
feeds, GRIB2 NWP output, a buoy network, or a third-party Lagrangian
ocean-drift service — plugs in as a **provider** that POSTs into the
ingest routes. The service stores the WILL-canonical shape; the impact and
drift engines are provider-agnostic.

## What it ingests

| Resource | Content |
|---|---|
| Observation | station, lat/lon, wind (dir/speed/gust), visibility, ceiling, temp/dew, precip, sea state, wave height — incl. a `POST /v1/obs/metar` raw-METAR decoder (WILL-minimal profile, defensive) |
| Forecast | TAF/NWP-style block: valid window, wind, visibility, ceiling, precip, sea state, wave height, provider |
| Flow field | surface current/wind samples (`u_east_mps`, `v_north_mps`) at lat/lon — the Lagrangian advection input |

## HTTP surface

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/healthz` | – | declares `mode: metoc-advisory` |
| POST | `/v1/obs/ingest` | operator | structured observation |
| POST | `/v1/obs/metar` | operator | raw METAR line → observation |
| GET | `/v1/obs` | operator | observation list |
| POST | `/v1/forecast/ingest` | operator | forecast from a provider |
| GET | `/v1/forecast` | operator | forecast list |
| POST | `/v1/flowfield/ingest` | operator | ocean/wind flow sample |
| GET | `/v1/flowfield` | operator | flow samples |
| GET | `/v1/impact?station=&…` | operator | **advisory** GO/CAUTION/NO_GO matrix |
| POST | `/v1/lagrangian/drift` | operator | **advisory** parcel-drift forecast |

## Operational-impact engine (`internal/impact`)

`Assess(conditions, assetKind)` returns GO/CAUTION/NO_GO with explicit
reasons. Per-asset, public-doctrine-style thresholds (integrators tune per
platform):

- **air_intercept** (CAP fighter): ceiling/visibility minima, gust
  crosswind, airframe icing.
- **uav** (MAVLink/Watchkeeper): wind/gust launch-recovery limit, icing
  NO_GO, low-visibility recovery.
- **eo_ir / c_uas**: visibility/cloud/heavy-precip degradation.
- **gmti_radar** (STANAG 4607): largely all-weather; heavy precip caution.
- **gun_shorad** (Skynex/C-RAM): EO degraded → radar mode advised.
- **nsm_coastal / naval**: Douglas sea state and wave-height limits.
- **sam_area** (Patriot): all-weather; minor heavy-precip caution.

Findings escalate to the worst status; clear weather is GO for every kind.

## Lagrangian drift engine (`internal/lagrangian`)

Forward-Euler parcel advection over a configurable step. Velocity at a
point is inverse-distance-weighted from nearby flow samples, falling back
to an analytic western Black-Sea surface set (the Rim Current, broadly
cyclonic off Constanța) when no samples are near. A **windage (leeway)**
term couples a constant surface wind into parcel motion. Positional
uncertainty grows linearly with elapsed time, so each waypoint carries a
`spread_m` 1-σ radius — the operator sees a widening search area, not a
false-precision dot. A step-count cap rejects pathological horizons.

## Demo (metoc-sim)

An advisory weather/ocean provider feed:

- **LRCV (Cincu)** METAR cycling clear → fog → high-wind → icing, plus a
  **BS-CONSTANTA** naval observation whose sea state cycles.
- A TAF-style forecast block for LRCV.
- A western Black-Sea **flow field** (Rim-Current samples off Constanța).
- A repeating Lagrangian **query**: where would a low-cost floating sensor
  released off Constanța drift over the next 6 h (with 2% windage)?

demo-ux **Weather** view: the GO/CAUTION/NO_GO impact matrix across asset
classes for the latest conditions, the observation/forecast panels, and a
drift-trajectory readout with growing spread. Advisory framing throughout.
