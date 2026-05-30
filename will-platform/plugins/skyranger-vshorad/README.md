# skyranger-vshorad

Rheinmetall **Skyranger 35** mobile VSHORAD ingest plugin. SAFE 2026
acquisition (ADR-018): 2 systems, €470M to Romanian Air Defence.

The plugin emits two `will.track.v0` streams:

- **detections** (`MQTT_TOPIC_DETECTIONS`, default `telemetry/cuas/skyranger`)
  — hostile UAS / RAM tracks from the mount's radar, tagged
  `metadata.threat=true`, `metadata.vshorad=true`.
- **platform PLI** (`MQTT_TOPIC_PLATFORM`, default `telemetry/bft/skyranger`)
  — the mount's own friendly position, tagged `metadata.platform=true`,
  reporting `mode`, `rounds`, `missiles`.

WILL is **coordinator-only**: no `Engage`/`Task` surface in the code, no
outbound socket to the mount. Engagement remains the vendor fire-control's
responsibility. Guarded by `TestNoTaskingSurface` in `internal/track`.

## Modes

| `MODE` | Behaviour |
|--------|-----------|
| `sim` (default) | mount drives a short patrol leg while 2 UAS converge on it; dev/HIL plausibility |
| `vendor` | real Rheinmetall feed adapter — follow-up declared by ADR-018, currently falls back to `sim` |

## Environment

| Var | Default | Meaning |
|-----|---------|---------|
| `MODE` | `sim` | feed source |
| `TENANT_ID` | `…0001` | tenant UUID |
| `CLASSIFICATION` | `NESECRET` | marking applied to outbound tracks |
| `SOURCE_PREFIX` | `skyranger/A1` | track source prefix |
| `MQTT_URL` | `tcp://emqx:1883` | bus |
| `MQTT_TOPIC_DETECTIONS` | `telemetry/cuas/skyranger` | hostile tracks |
| `MQTT_TOPIC_PLATFORM` | `telemetry/bft/skyranger` | own-mount PLI |
| `SIM_UNIT_ID` | `skyranger-A1` | sim unit id |
| `SIM_START_LAT` / `SIM_START_LON` | `45.700` / `24.500` | patrol leg start |
| `SIM_HEADING_DEG` | `45` | patrol bearing |
| `SIM_PATROL_SPEED_MPS` | `5` | platform speed |
| `SIM_NUM_TRACKS` | `2` | concurrent inbound UAS |
