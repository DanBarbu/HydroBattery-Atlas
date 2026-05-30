# lynx-ifv

Rheinmetall **Lynx KF41** tracked IFV ingest plugin. SAFE 2026 acquisition
(ADR-018): 298 vehicles, €3.337B framework, Phase I 232 by 2030 — the
largest single SAFE contract for Romanian Land Forces.

Emits friendly tracked-IFV PLI + vehicle health summary to
`telemetry/bft/lynx`: position, heading, speed, fuel %, engine status,
comms status, crew state, march state, and **advisory** ammo counts.

WILL is **coordinator-only**:

- No turret control, no fire-control access, no ammunition release.
- Ammo counts are **advisory only** — they populate the operator picture but
  are not a fire-control surface; the FCS is the vendor's.
- No `Engage`/`Task`/`Fire`/`Turret` entry point in the code.
- No outbound socket to the vehicle bus or the FCS.
- `TestNoTaskingSurface` in `internal/track` documents the discipline.

## Modes

| `MODE` | Behaviour |
|--------|-----------|
| `sim` (default) | platoon of 4 Lynxes on a road march at 8 m/s with 75 m column spacing, draining fuel |
| `vehicle-bus` | Rheinmetall vehicle-telemetry adapter — follow-up (vendor protocol access); falls back to `sim` |
| `cot` | crew-tablet CoT PLI adapter — follow-up (reuse atak-mil decoder pattern); falls back to `sim` |

## Environment

| Var | Default | Meaning |
|-----|---------|---------|
| `MODE` | `sim` | feed source |
| `TENANT_ID` | `…0001` | tenant UUID |
| `CLASSIFICATION` | `NESECRET` | marking applied to outbound tracks |
| `SOURCE_PREFIX` | `lynx/btn-1` | track source prefix (battalion level) |
| `MQTT_URL` | `tcp://emqx:1883` | bus |
| `MQTT_TOPIC` | `telemetry/bft/lynx` | publish topic (BFT layer) |
| `SIM_UNIT_PREFIX` | `lynx` | vehicle id prefix |
| `SIM_START_LAT` / `SIM_START_LON` | `45.850` / `24.780` | column start position |
| `SIM_HEADING_DEG` | `90` | march bearing |
| `SIM_MARCH_SPEED_MPS` | `8` | column speed |
| `SIM_VEHICLES` | `4` | platoon size |
