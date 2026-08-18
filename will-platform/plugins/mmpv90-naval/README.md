# mmpv90-naval

Rheinmetall **MMPV-90** offshore patrol vessel / corvette ingest plugin.
SAFE 2026 acquisition (ADR-018): 2 hulls built locally for Romanian Navy
Black Sea operations.

## Phase 1: ingest-only (this commit)

Three streams keep the operational and OSINT layers distinct (ADR-016):

| Topic env | Default | Purpose |
|-----------|---------|---------|
| `MQTT_TOPIC_OWNSHIP` | `telemetry/bft/mmpv90` | friendly own ship PLI (hull, pennant, heading, speed, heel, sea state, fuel, helm + comms status) |
| `MQTT_TOPIC_SENSOR` | `telemetry/sensor/mmpv90` | naval radar / EO / IR / ESM / sonar detections; affiliation drives the `threat` tag |
| `MQTT_TOPIC_AIS_OSINT` | `telemetry/osint/mmpv90-ais` | AIS broadcasts; classification forced to `<base> // OSINT`, `metadata.osint=true`, `confidence=low` |

The AIS path is the same shape as `adsb-osint`: third-party broadcasts are
advisory, never auto-fused with operational naval tracks.

## Phase 2 (NOT in this commit)

Bidirectional posture (e.g. publishing the WILL maritime picture back to
the ship's CMS) is blocked on Squad Alpha's **Link-22 / STANAG 5522**
gateway. ADR-018 declares the dependency but does NOT block Phase 1 on it.

## Coordinator discipline

WILL is coordinator-only:

- No CMS replacement, no weapons direction, no sail orders.
- No `Engage`/`Task`/`Helm`/`Fire` entry point in the code.
- No outbound socket to the ship's combat-management or steering systems.
- `TestNoTaskingSurface` in `internal/track` documents the discipline.

## Modes

| `MODE` | Behaviour |
|--------|-----------|
| `sim` (default) | corvette steaming east from Constanța at 12 m/s; 1 unknown surface contact 7.5 km off, 1 unknown air transit at 9.5 km altitude, 1 westbound AIS merchant |
| `vendor` | Rheinmetall CMS / sensor feed adapter — Phase 1 follow-up; falls back to `sim` |
| `link22` | Phase 2 bidirectional — blocked on Link-22 gateway; falls back to `sim` |

## Environment

| Var | Default | Meaning |
|-----|---------|---------|
| `MODE` | `sim` | feed source |
| `TENANT_ID` | `…0001` | tenant UUID |
| `CLASSIFICATION` | `NESECRET` | operational marking (AIS path forces OSINT caveat regardless) |
| `SOURCE_PREFIX` | `mmpv90/F501` | source prefix for all three streams |
| `MQTT_URL` | `tcp://emqx:1883` | bus |
| `SIM_HULL_ID` / `SIM_PENNANT` | `F501` / `501` | hull and pennant id |
| `SIM_START_LAT` / `SIM_START_LON` | `44.170` / `28.650` | start position (Constanța approach) |
| `SIM_HEADING_DEG` | `90` | patrol heading |
| `SIM_CRUISE_MPS` | `12` | patrol speed (~23 knots) |
