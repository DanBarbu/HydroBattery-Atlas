# ADR-015 — METOC module (weather + Lagrangian drift), advisory

- Status: Accepted
- Date: (post legacy-c2 bridge)
- **Co-signed: Tech Lead · Compliance Officer**; Consulted: Security, Fusion Engineer, both Scrum Masters

## Context

Operations need meteorology & oceanography (METOC) in the C2 picture:
current conditions, forecasts, and — critically for the Black Sea
floating-sensor swarm, CBRN/plume dispersion, and search-and-rescue — a
**Lagrangian drift** capability that advects parcels/particles through a
wind+current field along their trajectories (vs Eulerian grid display).
A specific external weather platform is to be integrated; rather than
couple to one vendor, WILL wraps **any** provider via normalized ingest
(provider-adapter), and that platform plugs in as a provider.

## Decision

Add a `metoc` service.

### Capabilities

1. **Observation ingest** — a WILL-minimal **METAR** parser plus a
   normalized observation shape (so GRIB2/TAF/STANAG-6022 providers, or
   the referenced Lagrangian platform, feed in through an adapter).
2. **Forecast ingest** — point/period forecasts in the normalized shape.
3. **Operational-impact decision support** — per asset class
   (air_intercept, uav, gun_shorad, c_uas, gmti_radar, eo_ir,
   nsm_coastal, naval, sam_area), return **GO / CAUTION / NO-GO** with
   explicit reasons (ceiling, visibility, wind/gust, icing, sea state).
4. **Lagrangian drift** — advect a release point through an ingested (or
   default analytic) wind+current **flow field**, returning a trajectory
   with growing 3-σ spread. Used for floating-sensor drift, plume
   dispersion, and SAR datum drift.

### The boundary (why this needs an ADR)

- **Advisory only.** Impact assessments and drift forecasts inform the
  operator; they never auto-task, auto-abort, or change an engagement.
  Same coordinator discipline as ADR-008/012/013/014;
  `api_test.go::TestNoTaskingRoutes` asserts no actioning route exists.
- **Provider-adapter, wrap-don't-own.** WILL ingests normalized METOC; it
  is not the authoritative forecast producer. The external platform
  remains the source of truth for its products.
- **Classification preserved** (ADR-005); tenant-scoped; RLS (ADR-006).
- **Public methods only.** METAR/TAF/GRIB2/STANAG-6022 are public;
  Lagrangian advection is standard ocean/atmosphere drift modelling. No
  proprietary platform code or data.

## Alternatives considered

- *Couple directly to the one external weather platform.* Rejected —
  vendor lock-in; the adapter pattern lets that platform be one provider
  among many (national ANM, ECMWF/GFS, the Lagrangian platform).
- *Eulerian grid only.* Rejected — the floating-sensor and dispersion use
  cases are intrinsically Lagrangian (follow the parcel), which a grid
  display does not answer.
- *Auto-degrade engagements on weather.* Rejected — crosses the advisory
  boundary; the operator decides.

## Consequences

- New `metoc` service (`metar`, `impact`, `lagrangian`, `store`, `api`)
  + `metoc-sim` (Cincu airfield METAR + Black Sea flow field + a drifting
  floating-sensor release).
- New schema V0015 (`metoc_observations`, `metoc_forecasts`,
  `metoc_flowfield`) with RLS.
- demo-ux **Weather** view: current obs, forecast strip, the impact
  matrix (asset × GO/CAUTION/NO-GO), and a Lagrangian drift readout.
- BMS may *consult* impact read-only in a future change (advisory
  "weather CAUTION for this effector") — declared, not built.
- Wire-level GRIB2 and STANAG-6022 METCM are clean additive follow-ups.

## Status

Delivered. See `docs/metoc/architecture.md`.
