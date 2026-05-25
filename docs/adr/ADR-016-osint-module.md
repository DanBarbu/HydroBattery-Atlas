# ADR-016 — OSINT module (ADS-B / AIS / TLE / hazards), advisory & low-confidence

- Status: Accepted
- Date: (post METOC)
- **Co-signed: Tech Lead · Compliance Officer · Security Engineer**; Consulted: Product Owner, both Scrum Masters, Fusion Engineer

## Context

A LinkedIn-publicised open-source project (**OSIRIS**,
`github.com/simplifaisoul/osiris`) aggregates 15 public intelligence
streams (ADS-B, AIS, satellite TLE, wildfires, earthquakes, severe
weather, conflict events, public CCTV) and a built-in RECON toolkit
(Nmap, WHOIS, DNS) into a Cesium-style 3D globe. WILL already has the
globe, the layer-toggle pattern, the `will.track.v0` canonical schema,
and a Plugin SDK — the question is which of OSIRIS's *feeds and patterns*
are worth importing, and where the boundary is.

OSINT in WILL must answer a different question than OSIRIS: not "what
can we see?" but "what civilian / public-domain context does the
operator need around the trusted operational picture, without
contaminating it?"

## Decision

Add an **`osint`** capability area composed of independent, opt-in
sensor plugins under the existing Plugin SDK, plus modest extensions to
METOC for hazard layers. Every OSINT plugin emits canonical
`will.track.v0` (or a METOC observation) carrying:

- `source` = `osint/<plugin>`
- `metadata.osint = true`
- `metadata.confidence = "low"` (default; never higher than `medium`)
- STANAG 4774 marking `NESECRET // OSINT`
- A dedicated MQTT topic prefix `telemetry/osint/<plugin>` so the
  frontend can render OSINT as **its own layer** with distinct styling
  (dashed outline, reduced opacity, "OSINT" badge), and so the fusion
  service can **exclude** OSINT from trusted-track correlation by
  default.

### In scope (initial plugins, in priority order)

1. **`adsb-osint`** — civilian air picture (OpenSky Network public REST,
   or a local dump1090 receiver). Stub delivered with this ADR.
2. **`ais-osint`** — civilian maritime picture (AISStream / AISHub).
   Already half-justified by ADR-011 (naval/own-ship).
3. **`sat-tle`** — satellite tracking from Celestrak / Space-Track TLEs
   propagated with SGP4. Genuinely new capability: overhead-pass
   awareness for Cincu / Constanța.
4. **METOC hazard extension** — NASA FIRMS (wildfires), USGS (seismic),
   GDACS (multi-hazard) ingested via the METOC adapter (ADR-015), not a
   new service.
5. **`geo-events`** — ACLED / GDELT conflict-event aggregator as its own
   advisory layer.

### Patterns to import from OSIRIS

- **Viewport-aware progressive loading** in the Cesium layer once
  on-screen track counts exceed a few thousand. Pure performance.
- **OSINT confidence model**: a single `confidence ∈ {low, medium, high}`
  field across all OSINT sources, surfaced in the UI.

### The boundary (why this needs an ADR)

- **No active reconnaissance.** OSIRIS's RECON toolkit (Nmap, WHOIS,
  DNS scans, port probes) **is explicitly out of scope** and must not
  appear in WILL. Active scanning of external infrastructure from an
  ORNISS-accredited defence C2 is unlawful without separate cyber-ops
  authority, raises export-control issues (EU Reg. 2021/821), and would
  invalidate the platform's accreditation profile. If MoD needs this
  capability it belongs in a separately accredited cyber tool.
- **No public CCTV scraping.** Public-camera aggregation conflicts with
  GDPR + Romanian Law 190/2018 + Law 363/2018 at the scale OSIRIS
  attempts. Only lawfully-sourced cameras (ministry-owned, range
  cameras at Cincu/Capu Midia) may appear, and must go through the
  existing sensor SDK with a documented lawful basis.
- **No auto-promotion into the trusted track set.** OSINT is advisory
  context. Fusion (libRSF/GTSAM track correlation) must require an
  explicit operator action to merge an OSINT track with a trusted-sensor
  track; the default join policy excludes `metadata.osint = true`.
  A conformance test on the fusion service will enforce this once the
  fusion module merges OSINT-aware inputs.
- **Classification preserved** (ADR-005). OSINT is `NESECRET // OSINT`
  on the wire; any operator action that lifts an OSINT track into a
  higher-classification context creates a new, separately marked track
  rather than re-marking the original.
- **Tenant-scoped** (ADR-006). OSINT respects the same RLS as everything
  else; per-tenant feature toggle in `tenant-admin` lets a tenant
  disable OSINT entirely.
- **Public methods only.** No proprietary data, no scraped paywalled
  feeds. Every provider listed above publishes terms-of-use compatible
  with research/government use; the plugin must document the legal
  basis in its README.
- **No sovereign-cloud exception.** OSINT plugins deploy to the same
  OCI EU-Sovereign regions (or CPG/STS, or on-prem) as the rest of WILL.
  No Vercel Edge, no third-party data-proxy SaaS.

## Alternatives considered

- *Fork OSIRIS and re-skin it as the WILL OSINT view.* Rejected — its
  RECON toolkit and CCTV layer are direct boundary violations, its
  hosting model (Vercel Edge) is incompatible with sovereign-cloud
  requirements, and WILL already owns a more capable Cesium-based UI.
- *Treat OSINT as just another set of normal sensors.* Rejected —
  without the `osint=true` flag and confidence floor, OSINT noise can
  pollute fusion and the trusted picture; the failure mode is
  operationally serious (false air tracks during a real engagement).
- *Stand up a separate OSINT-only deployment.* Rejected for the demo /
  Phase-1 release — duplicated infra for marginal isolation benefit;
  per-tenant feature toggle achieves the same outcome.

## Consequences

- New plugins under `will-platform/plugins/` starting with
  `adsb-osint` (stub delivered alongside this ADR). Each plugin is
  independently deployable and independently toggleable per tenant.
- A new top-level UI layer category **OSINT** in the layer toggles,
  styled distinctly (dashed outline, reduced opacity, "OSINT" badge).
- Fusion service must, when it lands, exclude `metadata.osint = true`
  from default correlation; a new conformance test asserts this.
- METOC (ADR-015) gains additive hazard providers (FIRMS / USGS /
  GDACS) via the existing observation/forecast ingest routes — no new
  service.
- Documentation: each OSINT plugin README must record its legal basis,
  terms-of-use, and the rate limits it respects.

## Status

ADR Accepted. First plugin (`adsb-osint`) delivered as a stub with this
ADR; remaining plugins are clean additive follow-ups under the same
boundary.
