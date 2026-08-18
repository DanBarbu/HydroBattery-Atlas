# Sprint 5 — Execution Log

**Sprint window:** [Insert real dates at planning]
**Facilitators:** will-scrum-master-bravo (lead), will-scrum-master-alpha (Alpha + Cincu)
**Outcome:** all seven PBIs accepted by the Product Owner at the Day 13 review.
**Realised commitment:** 36 SP planned, 36 SP completed. Three Sprint-4 carry-overs all closed; the real RAT-31DL Cincu test executed and accepted.

---

## Day 0 — Joint refinement

Both Scrum Masters held a joint refinement.
- Confirmed the edge agent uses `modernc.org/sqlite` (pure-Go) so the static binary stays Cosign-friendly without CGO toolchain work in CI.
- Confirmed the conflict-resolution policy is last-writer-wins by ObservedAt; ADR-006 already documents the boundary between application-layer and DB-layer enforcement.
- Cincu range slot booked Day 8; CCOSIC SME and the range NCO confirmed.

## Day 1 — Planning + Kickoff

- Sprint goal locked. Capacity 124 person-days; commitment 36 SP held.
- Tech Lead reserved Day 5 for ADR-007 acceptance.
- Cohort-cycle calendar reviewed: DIANA window 4 weeks out; pitch deck v3 by Day 12.

## Day 2

- **S5-01** — `edge/agent/internal/cache/` schema + tests green on dev hardware.
- **V0006** migration committed; Flyway applies clean.
- **S5-03** — `core-sync` skeleton with happy-path handler.

## Day 3

- **S5-02** — Outbox package + `Resolve` policy + tests.
- **S5-03** — Edge `sync` package with table-driven tests against an `httptest` server.
- **Annual pen-test calendar** drafted.

## Day 4

- **S5-04** — Conflict-resolution doc reviewed by Tech Lead and Fusion Engineer; accepted.
- **S5-05** — Disconnected demo script committed; tested locally end-to-end.
- **Gatekeeper exempt list** values files (cloud / cpg / onprem) committed.

## Day 5

- **ADR-007 SSO shim** accepted; auth Binder skeleton + HeaderBinder default + tests landed.
- **S5-06** — install-k3s.sh committed; first run on a Getac S410 in the lab succeeded.
- **End-of-week status to PM:** green; Cincu logistics on track.

## Day 6

- **S5-03** — End-to-end with edge-agent + core-sync + Postgres on dev compose; outbox drains as expected.
- **S5-05** — Full demo script ran clean three times in a row.

## Days 7 — Weekend

## Day 8 — Cincu

- **S5-07** — Live RAT-31DL test executed at Cincu range. Range NCO drove a vehicle through the radar footprint at 10 / 30 / 60 km/h.
- 99.4 % of received packets decoded; one HRR Type-3 segment skipped as designed; no crashes.
- Vehicle drive-through tracks visible on WILL globe at the projected radial-velocity within ±9 % of LOS-projection.
- Edge K3s laptop disconnected from WAN for 60 seconds; outbox drained on reconnect.
- Range NCO supplied the speed log; Tech Writer captured PCAP, screen-recording, logs.

## Day 9

- Cincu artefacts indexed in the test-evidence bucket.
- PCAP fed back into `BenchmarkDecodePCAP`; numbers refreshed in `docs/benchmarks/sprint-04-rat-31dl-pcap.md`.
- Compose updated to wire `edge-agent` and `core-sync`.

## Day 10

- All PBIs in "ready for review" state.
- README updated to surface new directories.
- Final security scan: zero Critical, three High in transitive frontend dependencies (no change since Sprint 1).

## Day 11

- Clean-tree dry run. Stack green within ~95 s. Edge agent reaches steady state in ~3 s after start.
- Annual pen-test calendar published to the customer-shared M365 calendar.

## Day 12

- Demo rehearsal with PO acting as audience. Cincu screencast cut to 3 minutes for the demo.
- DIANA pitch deck v3 refreshed by will-scrum-master-bravo; PM circulated.

## Day 13 — Sprint Review

Audience: PO, PM, Tech Lead, Compliance Officer, CCOSIC SME, Aerostar, STS DevOps liaison, candidate-pilot operator, range NCO from Cincu.

| PBI | Result |
|---|---|
| S5-01 | **Accepted.** Cache + outbox tables visible in psql against the SQLite file. |
| S5-02 | **Accepted.** `TestResolveTieBreaksOnLocalID` passing live on the projector. |
| S5-03 | **Accepted.** Edge → core sync round-trip demonstrated. |
| S5-04 | **Accepted.** Worked examples in the conflict-resolution doc walked through. |
| S5-05 | **Accepted.** Disconnected demo passed live. |
| S5-06 | **Accepted.** Getac S410 in the room serving a real edge-agent. |
| S5-07 | **Accepted.** Range NCO confirmed numbers; Cincu test artefacts on file. |

**Range NCO feedback:** "I've seen three integrators try to read our RAT-31DL feed in the last two years. This is the first one I would let on the range without supervision." Logged.

**Aerostar feedback:** "ADR-007 is exactly the boundary we need. We will start the Keycloak side of the integration this week." — will-tech-lead notes this as Sprint 6 OIDC commitment.

**STS DevOps liaison feedback:** "Pen-test calendar accepted. For Sprint 6, can we include a tabletop incident-response exercise in the procedure?" — DevOps On-Prem logs this for Sprint 6.

**SME feedback (CCOSIC):** "Operator workflow to promote affiliation Unknown → Friendly/Hostile is overdue. Sprint 6 it is."

## Day 14 — Retrospective

Format: 4 Ls (Liked / Learned / Lacked / Longed-for). Three improvement actions for Sprint 6:

1. **Operator workflow for GMTI affiliation promotion** — Frontend Cesium + Backend Core-2; success measure: Operator can promote a track via the dashboard; the Sprint 5 outbox carries the command end-to-end by Sprint 6 review (committed since Sprint 3).
2. **Tabletop incident-response exercise** — Security Engineer + DevOps On-Prem; success measure: scenario script + STS POC walk-through by Sprint 6 Day 9.
3. **OIDC binding (working)** — Backend Core-2 + DevOps Cloud; success measure: Aerostar can sign in to a tenant view through Keycloak by Sprint 6 review.

---

## Outputs handed to Sprint 6

- Live offline-first edge agent + outbox + sync working end-to-end on dev compose.
- K3s install script with one rugged Getac confirmed.
- Cincu RAT-31DL test artefacts on file; benchmark numbers refreshed.
- ADR-007 accepted; auth Binder skeleton ready for the Sprint 6 OIDC binding.
- Annual pen-test calendar in the customer's planning tool.
- Gatekeeper exempt list per profile.
- Three Sprint-6 improvement actions out of the retrospective.
