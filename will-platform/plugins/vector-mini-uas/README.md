# vector-mini-uas

Quantum Systems **Vector** (Class I Mini UAS) and **Scorpion** ingest plugin.
SAFE 2026 acquisition (ADR-018): 34 Vector + 15 Scorpion kits, €30.7M to
Romanian Land ISR, delivery 2027.

Vector is a **friendly ISR asset**, so this plugin emits friendly air PLI to
`telemetry/uas/vector` — `metadata.platform=true`, `metadata.unmanned=true`,
`metadata.isr=true`, never `metadata.threat=true`.

WILL is **coordinator-only**: no flight tasking from WILL, no `Engage`/
`Task`/`Command` surface, no outbound socket to the Vector ground station.
`TestNoTaskingSurface` in `internal/track` documents the discipline.

## Modes

| `MODE` | Behaviour |
|--------|-----------|
| `sim` (default) | one Vector orbiting a centre point, draining battery, AUTO → RTL at 25 % battery (dev/HIL) |
| `mavlink` | MAVLink-passthrough adapter — follow-up declared by ADR-018; currently falls back to `sim` |
| `quantum` | QBase proprietary control-link adapter — follow-up (vendor SDK access); currently falls back to `sim` |

## Environment

| Var | Default | Meaning |
|-----|---------|---------|
| `MODE` | `sim` | feed source |
| `TENANT_ID` | `…0001` | tenant UUID |
| `CLASSIFICATION` | `NESECRET` | marking applied to outbound tracks |
| `SOURCE_PREFIX` | `vector/gcs-1` | track source prefix |
| `MQTT_URL` | `tcp://emqx:1883` | bus |
| `MQTT_TOPIC` | `telemetry/uas/vector` | publish topic |
| `SIM_UNIT_ID` | `vector-01` | sim airframe id |
| `SIM_VARIANT` | `Vector` | `Vector` or `Scorpion` |
| `SIM_ORBIT_LAT` / `SIM_ORBIT_LON` | `45.870` / `24.800` | orbit centre |
| `SIM_ORBIT_RADIUS_M` | `1500` | orbit radius |
| `SIM_VIDEO_URL` | (empty) | optional advisory video stream URL |
