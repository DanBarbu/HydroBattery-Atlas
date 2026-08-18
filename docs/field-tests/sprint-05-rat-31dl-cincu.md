# Sprint 5 Field Test — RAT-31DL @ Cincu Range

**Owner:** will-qa-hil with will-backend-tdl
**Authority:** CCOSIC SME committed at the Sprint 3 review; Sprint 4 RAT-31DL PCAP benchmark unblocked the parser side.
**Site:** Cincu Joint National Training Centre, fixed RAT-31DL emplacement.
**Goal:** Confirm the WILL GMTI plugin ingests **live** RAT-31DL emissions over a real network link (no PCAP), publishes Tracks for each target report, and renders distinctive symbology with radial-velocity labels — under the same operational conditions an integrator would face on Day 1 of an MApN deployment.

## Pre-test (T-7 days)

- [ ] Range slot booked with the Cincu range office; security clearances confirmed (Sprint 4 INFOSEC consultant runs the briefing).
- [ ] CCOSIC SME confirms the radar's STANAG 4607 output port and IP.
- [ ] Edge K3s laptop provisioned with `install-k3s.sh` (Sprint 5 S5-06).
- [ ] WILL stack at tag `sprint-5-fieldtest`; `cot-replay`, `mavlink-sim`, `lora-sim` are stopped on the demo workstation.
- [ ] Air-gap mirror procedure NOT used here — Cincu is unclassified for this test.

## Pre-test (T-1 day)

- [ ] Test plan walked through with the range NCO and the radar operator.
- [ ] Frequency clearance for any RF-emitting WILL components: not required (we only receive STANAG 4607 over IP).
- [ ] WILL stack brought up on the demo workstation; verified locally with `gmti-replay`. Then `gmti-replay` stopped.

## Procedure

1. **Connect the radar feed.** Range engineer points the RAT-31DL's STANAG 4607 output to the WILL host's `udp:<host-ip>:8190`.
2. **Start a 38-second baseline capture** with `tcpdump -w cincu-baseline.pcap udp port 8190`.
3. **Confirm decode.** `docker compose logs gmti --since 1m | head -50` shows zero decode errors. `psql -c "select count(*) from tracks where track_kind='gmti' and observed_at > now() - interval '5 min'"` returns a non-zero count.
4. **Symbology check.** Open the WILL dashboard from the range laptop. Toggle layer **GMTI** on, others off. Confirm that target reports appear over the appropriate area in distinctive symbology with radial-velocity labels.
5. **Operator track.** Range NCO drives a vehicle through the radar's footprint at known speeds (10, 30, 60 km/h). Confirm the WILL globe shows the vehicle as a moving GMTI track and that radial velocity sign + magnitude are within ±15 % of the known speed projected onto the LOS.
6. **Resilience.** Disconnect the network between the radar and the WILL host for 30 seconds. Reconnect. Confirm WILL recovers without operator action; new packets re-render the picture.
7. **Edge offline-first integration.** Stop the WILL host's network connection to the WAN (simulating a tactical disconnect). The edge K3s laptop continues to render local GMTI tracks. Reconnect the WAN; confirm the Sprint 5 sync drains the edge outbox to the core.
8. **Stop captures**, archive PCAP, screen-recordings, and `docker compose logs > cincu-logs.txt`.

## Pass criteria

- ≥ 95 % of received packets decoded without error (worst-case acceptance).
- All target reports flow into PostgreSQL with `track_kind='gmti'`.
- The vehicle drive-through produces a recognisable GMTI track.
- Radial-velocity sign + magnitude within ±15 % of projected vehicle speed.
- 30-second network drop on the radar side does not crash the GMTI plugin.
- Edge agent survives the WAN disconnect; outbox drains on reconnect.

## Recording and artefacts

- `cincu-baseline.pcap` — 38-second capture for benchmark refresh.
- `cincu-drive.mp4` — drive-through screen recording (5 min cap).
- `cincu-logs.txt` — `docker compose logs` for the test window.
- All artefacts stored in the test-evidence bucket; index updated by Tech Writer.

## Sprint 5 follow-ups

- The PCAP refreshes `docs/benchmarks/sprint-04-rat-31dl-pcap.md` numbers.
- Any decode error surfaced by the live test feeds the Sprint 6 fusion engine acceptance.
- Lessons go into the Sprint 5 retrospective.

## Out of scope

- HRR (Type 3) segments — Sprint 6+.
- Live Link-16 ingest — Sprint 8.
- Operator workflow to promote affiliation — Sprint 6.
- mTLS between radar and WILL host — Sprint 10 (today this is on the trusted range LAN).
