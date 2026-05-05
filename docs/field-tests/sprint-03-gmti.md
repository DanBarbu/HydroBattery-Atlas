# Sprint 3 Field Test — STANAG 4607 GMTI Simulator

**Owner:** will-qa-hil with will-backend-tdl
**Site:** Lab Faraday cage; if a friendly RAT-31DL or comparable simulator is available at MApN, half-day on-site visit.
**Goal:** Confirm the GMTI plugin ingests STANAG 4607 packets, decodes the WILL minimal profile (Mission + Dwell with the fixed existence mask), publishes one Track per target report onto EMQX, and renders distinctive GMTI symbology with radial velocity in the dashboard.

## Pre-test checklist

- [ ] WILL stack at tag `sprint-3-fieldtest` running.
- [ ] `gmti-replay` container stopped during the active radar-simulator phase: `docker compose stop gmti-replay`.
- [ ] Radar simulator (or partner-supplied STANAG 4607 generator) configured to send to UDP `<host-ip>:8190`.
- [ ] Operator station connected; GMTI layer toggle on.

## Procedure

1. Bring up the stack: `docker compose up -d`.
2. Verify `gmti-replay` is producing decoded tracks (default state). In the dashboard, three "vehicle" GMTI markers should appear near Cincu with radial-velocity arrows in the labels.
3. Stop the synthetic generator: `docker compose stop gmti-replay`.
4. Point the radar simulator at the WILL host.
5. Confirm GMTI tracks appear within 3 s of the first dwell.
6. Toggle the **GMTI** layer off; confirm the markers disappear while CoT and MAVLink markers stay.
7. Toggle GMTI back on; markers reappear at the next dwell.
8. Inject a malformed packet (truncated mid-segment) using the lab packet injector; confirm `docker compose logs gmti` shows a single decode-error entry and the plugin continues running.
9. Inject a packet whose ExistenceMask does not match the WILL minimal profile; confirm the plugin rejects with a clear log line referencing the mask mismatch.

## Pass criteria

- GMTI markers appear on the globe, distinctive from CoT and MAVLink.
- Each marker label shows the source identifier and a directional arrow + radial velocity.
- Layer toggle hides and reveals only the GMTI family.
- Malformed and mask-mismatch packets do not crash the plugin and do not pollute the dashboard.
- No GMTI track loses its `track_kind=gmti` tag in PostgreSQL.

## Recording and artefacts

- `tcpdump -w gmti-fieldtest.pcap udp port 8190` for the test window.
- Screen-recording of the dashboard (5 min cap).
- `docker compose logs gmti gmti-replay` exported to the test-evidence bucket.

## Out of scope for Sprint 3

- HRR (High Range Resolution) segments — Sprint 6+.
- Free-text and Job Definition segments — Sprint 6+.
- Real-time SNR-based track-quality fusion — Sprint 6.
- IFF / affiliation promotion via operator workflow — Sprint 4 RBAC ships the role; Sprint 6 ships the workflow.
- Live RAT-31DL on the air at Cincu — coordinated with MApN for Sprint 4 or 5 depending on calendar.
