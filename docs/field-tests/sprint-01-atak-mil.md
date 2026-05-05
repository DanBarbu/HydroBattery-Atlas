# Sprint 1 Field Test — ATAK-MIL Tablet

**Owner:** will-qa-hil with will-backend-plugins-2
**Authority:** CCOSIC SME committed an ATAK-MIL endpoint at the Sprint 0 review
**Site:** Lab Faraday cage; if necessary, Cincu range half-day
**Goal:** Confirm the ATAK-MIL adapter ingests live CoT from a real Android tablet running ATAK-MIL and renders the operator on the WILL globe with correct affiliation colour and callsign label.

## Pre-test checklist

- [ ] One Android tablet with ATAK-MIL installed and provisioned with a self-signed CA in the test domain.
- [ ] Tablet network reachable from the WILL host running compose; no NAT between them or NAT explicitly mapped for UDP/8087.
- [ ] WILL stack at the tag `sprint-1-fieldtest` running on the host.
- [ ] `cot-replay` service stopped (`docker compose stop cot-replay`) for the duration of the live test to avoid contention.
- [ ] Time on the tablet within 2 s of the WILL host (NTP).

## Procedure

1. Bring up the stack: `docker compose up -d`.
2. Stop the synthetic replay: `docker compose stop cot-replay`.
3. On the tablet, configure ATAK-MIL TAK Server address to `udp://<host-ip>:8087`.
4. In the WILL dashboard, log in and confirm the Plugin Info panel shows `atak-mil` as `SERVING`.
5. Walk a 100 m ground track with the tablet; confirm the friendly icon (blue) appears on the globe and updates at the tablet's reporting cadence (typically 1 Hz).
6. On the tablet, drop a hostile contact via ATAK's drag-drop palette; confirm the icon appears on the WILL globe in red.
7. Disconnect the tablet's network for 60 s; confirm WILL marks the source as stale (oldest visible label timestamp updates correctly when the tablet reconnects).

## Pass criteria

- Operator track appears on the WILL globe within 3 s of tablet first publication.
- Affiliation colour matches CoT type: friendly = blue, hostile = red, neutral = green, unknown = yellow.
- Callsign visible on the icon label.
- No CoT decoder errors in `docker compose logs atak-mil` during the test (informational logs allowed).
- Disconnect test: WILL gracefully tolerates loss of tablet for 60 s; no crash, no leaked entities.

## Recording and artefacts

- Capture `tcpdump -w atak-mil-fieldtest.pcap udp port 8087` on the WILL host for the test window.
- Screen-record the dashboard for the test window (5 min cap).
- Upload PCAP and recording to the test-evidence bucket; reference from the Sprint 1 execution log.

## Out of scope for Sprint 1

- Long-range RF connectivity (Meshtastic / HF) — Sprint 8.
- mTLS between tablet and adapter — Sprint 10.
- Classification banner per-track binding — Sprint 9.
- Performance under operator-density load (>20 tablets) — Sprint 15 stress test.
