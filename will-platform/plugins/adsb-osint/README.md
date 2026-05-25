# adsb-osint — ADS-B OSINT plugin

ADR-016. Civilian air picture as an **advisory, low-confidence OSINT
layer** on the COP. Every track is marked `metadata.osint = true`,
`metadata.confidence = "low"`, and `classification = "NESECRET // OSINT"`.

## Modes

- `MODE=sim` (default) — synthetic ADS-B-shaped fleet over a configurable
  bbox. Lab/air-gap safe; no external dependency.
- `MODE=opensky` — polls the OpenSky Network public REST endpoint
  `/api/states/all` for state vectors inside the bbox.

## Lawful basis (per ADR-016)

- **OpenSky Network** publishes its API under terms permitting
  research and non-commercial use. Operational use in a deployed tenant
  requires a documented agreement with the OpenSky community
  (or a paid OpenSky/aviation-data contract) and entry in the tenant's
  data-processing record.
- The `User-Agent` identifies the plugin and ADR (`WILL-adsb-osint/0.1
  (+ADR-016)`) so the upstream provider can attribute traffic.
- Polling interval defaults to **15 s** (`OPENSKY_PERIOD_S`) — above the
  unauthenticated rate cap. Do not lower without the upstream's consent.
- No active reconnaissance is performed; the plugin only consumes
  broadcast/polled public data.

## Configuration

| Env | Default | Purpose |
|---|---|---|
| `MODE` | `sim` | `sim` or `opensky` |
| `MQTT_HOST` / `MQTT_PORT` | `emqx:1883` | MQTT broker |
| `MQTT_TOPIC` | `telemetry/osint/adsb` | OSINT-prefix topic (do not change to a non-`osint/` prefix) |
| `TENANT_ID` | demo tenant | tenant routing |
| `CLASSIFICATION` | `NESECRET // OSINT` | STANAG 4774 marking |
| `BBOX_{SOUTH,NORTH,WEST,EAST}` | Romania + W. Black Sea | viewport bbox |
| `PUBLISH_HZ` (sim) | `1` | sim publish rate |
| `SIM_AIRCRAFT` | `12` | synthetic fleet size |
| `OPENSKY_PERIOD_S` | `15` | poll period (polite) |

## Output schema

Standard `will.track.v0` (`docs/contracts/track-v0.json`) with the OSINT
discipline applied. Frontend renders this topic as the OSINT/ADS-B
layer (dashed outline, reduced opacity, "OSINT" badge); fusion
**excludes** `metadata.osint = true` from default trusted-track
correlation.
