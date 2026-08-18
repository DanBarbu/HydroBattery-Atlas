# Sprint 1 — Sprint Review (Day 13)

**Duration:** 60 minutes.
**Audience:** Product Owner, Programme Manager, Tech Lead, Compliance Officer (optional), one CCOSIC SME (committed at Sprint 0 review), one operator from the candidate pilot unit (invited).
**Facilitator:** will-scrum-master-bravo (Sprint 1 lead) with will-scrum-master-alpha for the loader segment.

## Pre-flight (T-30)

- [ ] Stack at tag `sprint-1-review` running on the demo workstation.
- [ ] `cot-replay` container running so the demo has guaranteed traffic.
- [ ] If the CCOSIC tablet is on-site: ATAK-MIL configured to push UDP to the demo workstation; `cot-replay` paused (`docker compose stop cot-replay`).
- [ ] Plugin Info panel visible on screen.
- [ ] Browser tabs ready: dashboard, EMQX dashboard, plugin-loader `/v1/plugins`, GitLab CI green pipeline.
- [ ] Backup screencast for each major segment.

## Run sheet

### 0:00 — Recap (3 min)
will-scrum-master-bravo: sprint goal in one sentence; what the audience will see.

### 0:03 — The contract (5 min)
Backend Plugins-1: open `contracts/proto/will/sensor/v1/sensor.proto`. Walk through Describe / Health / Configure / Telemetry. Highlight three things:
1. Additive evolution discipline (ADR-002).
2. Classification field on Track is mandatory and validated at the loader (ADR-005).
3. APP-6D SIDC field carries affiliation and dimension.

### 0:08 — Reference plugin (4 min)
Backend Plugins-1: 30-line walk through `plugins/reference-echo/src/echo_plugin.py`. The point: a plugin is small.

### 0:12 — Plugin loader and Plugin Info panel (8 min)
Backend Core-1: `curl http://localhost:8080/v1/plugins | jq` shows the registry. Frontend Tenant-UX: switch to the dashboard, show the Plugin Info side panel. Restart `reference-echo` (`docker compose restart reference-echo`) and watch the panel update.

### 0:20 — CoT decoder (5 min)
Backend Plugins-2: open `plugins/atak-mil/internal/cot/cot_test.go` and run the suite. Show the fuzz line in the CI log. Explain the XXE defence and the bounded input.

### 0:25 — End-to-end with synthetic CoT (10 min)
QA Automation + Backend Plugins-2:
- Show `docker compose logs cot-replay` emitting friendly + hostile contacts.
- Show the WILL globe rendering the friendly icon (blue) circling Cincu and the hostile icon (red) transiting east-to-west.
- Show callsigns on labels.
- Stop `cot-replay` for 5 seconds; show the icons going stale; restart; show recovery.

### 0:35 — End-to-end with the live ATAK-MIL tablet (10 min)
*If the tablet is on-site.* QA HIL drives:
- Walk a short ground track with the tablet; show the operator on the WILL globe.
- Drop a hostile contact via ATAK; show it on the WILL globe in red.
- Show `tcpdump` capturing the UDP for evidence.

*If the tablet is not on-site,* substitute the synthetic demo and refer to the executed lab Faraday-cage test recording.

### 0:45 — Procurement / interoperability framing (3 min)
will-scrum-master-bravo: walk the procurement overlay. Sprint 1's outputs (Plugin SDK + first real sensor) are the credible kernel for a DIANA cohort pitch in the next window. NIF investment thesis sharpens when Sprint 4 multi-tenant lands.

### 0:48 — Tutorial (3 min)
Tech Writer: open the bilingual tutorial. Highlight one Romanian and one English section. Mention that a Bravo engineer who did not write the tutorial followed it during the sprint and produced a working plugin within 45 minutes.

### 0:51 — Acceptance and Q&A (9 min)
Product Owner reads each PBI and accepts/rejects. Programme Manager confirms next sprint slot.

## Failure protocol

Same as Sprint 0: keep talking, switch to backup screencast, file P1 bug, root-cause before Sprint 2 planning.
