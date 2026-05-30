# merops-osint

US **MEROPS** AI-powered counter-drone advisory feed plugin. Adjacent to the
SAFE 2026 wave (ADR-018): MEROPS is a **US-supplied** asset (US Counter-UAS
Marketplace), Shahed-proven in Ukraine; Romania consumes its feed as
**OSINT advisory** per ADR-016.

Publishes hostile-UAS advisory tracks to `telemetry/osint/merops`:

- `classification` is **forced** to `<base> // OSINT` regardless of input;
- `metadata.osint = true`, `metadata.confidence = "low"`;
- `metadata.threat = true`, `metadata.cuas = true`;
- `metadata.ai_classifier` records the MEROPS classifier label
  (`SHAHED` / `FIXED_WING` / `DJI_MAVIC` / `UNKNOWN`) and `ai_confidence`;
- `metadata.engagement_outcome` records what MEROPS reports
  (`NONE` / `JAMMING_APPLIED` / `KINETIC_APPLIED` / `TARGET_NEUTRALISED`
  / `TRACK_LOST`) — **advisory only**;
- `metadata.engagement_actuable_by_will = false` is hard-wired: WILL
  **does not actuate MEROPS**.

MEROPS tracks are NEVER auto-fused with the operational C-UAS picture.

## Coordinator discipline

- No `Engage` / `Task` / `Command` surface in the code.
- No outbound socket to MEROPS.
- Engagement outcomes are **reported, not actuated** — even a
  `KINETIC_APPLIED` outcome leaves `engagement_actuable_by_will = false`.
- `TestNoTaskingSurface` and `TestEngagementOutcomeIsAdvisoryOnly` document
  the discipline.

## Modes

| `MODE` | Behaviour |
|--------|-----------|
| `sim` (default) | inbound Shahed-style threat closing on a defended site; outcome progresses NONE → JAMMING_APPLIED → TARGET_NEUTRALISED |
| `marketplace` | US Counter-UAS Marketplace feed adapter — follow-up declared by ADR-018; needs US-side credential issuance + IL5/IL6 review; falls back to `sim` |

## Environment

| Var | Default | Meaning |
|-----|---------|---------|
| `MODE` | `sim` | feed source |
| `TENANT_ID` | `…0001` | tenant UUID |
| `CLASSIFICATION` | `NESECRET` | operational base; OSINT caveat is forced on top |
| `SOURCE_PREFIX` | `merops/site-1` | track source prefix |
| `MQTT_URL` | `tcp://emqx:1883` | bus |
| `MQTT_TOPIC` | `telemetry/osint/merops` | OSINT advisory topic |
| `SIM_SITE_LAT` / `SIM_SITE_LON` | `45.870` / `28.000` | defended site |
| `SIM_THREAT_BEARING_DEG` | `45` | direction the threat comes FROM |
| `SIM_THREAT_RANGE_M` | `12000` | initial standoff |
| `SIM_AI_CLASSIFIER` | `SHAHED` | classifier label fed into metadata |
