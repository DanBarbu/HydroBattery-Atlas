# skynex-cuas

Rheinmetall **Skynex** (35 mm AHEAD, Skymaster FC, 3-D acquisition radar)
C-RAM / C-UAS ingest plugin. SAFE 2026 acquisition (ADR-018): 7 systems,
€476M to Romanian Air Defence.

WILL is **coordinator-only**: this plugin ingests Skynex's track feed and
publishes `will.track.v0` to the bus. WILL does not task Skynex; engagement
remains the vendor fire-control's responsibility. There is no outbound
socket to Skynex and no `Engage`/`Task` entry point in the code.

## Modes

| `MODE` | Behaviour |
|--------|-----------|
| `sim` (default) | deterministic synthetic UAS approach scenario (dev + HIL game-days) |
| `vendor` | real Rheinmetall feed adapter — follow-up declared by ADR-018, currently falls back to `sim` |

The existing `plugins/skynex-mock` Python effector status emitter is retained
as a complementary process (effector status → `will.effector.v1`); this Go
plugin owns the sensor side (track → `will.track.v0`).

## Environment

| Var | Default | Meaning |
|-----|---------|---------|
| `MODE` | `sim` | feed source |
| `TENANT_ID` | `…0001` | tenant UUID |
| `CLASSIFICATION` | `NESECRET` | marking applied to outbound tracks |
| `SOURCE_PREFIX` | `skynex/battery-1` | track source prefix |
| `MQTT_URL` | `tcp://emqx:1883` | bus |
| `MQTT_TOPIC` | `telemetry/cuas/skynex` | publish topic |
| `SIM_NUM_TRACKS` | `2` | concurrent inbound UAS in sim mode |
| `SIM_PERIOD_S` | `2` | publish period per track |
| `SIM_BATTERY_LAT` / `SIM_BATTERY_LON` | `45.872` / `24.776` | protected asset |
