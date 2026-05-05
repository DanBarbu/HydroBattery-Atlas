# Sprint 1 — Execution Log

**Sprint window:** [Insert real dates at planning]
**Facilitators:** will-scrum-master-bravo (lead), will-scrum-master-alpha (Alpha + joint refinement)
**Outcome:** all nine PBIs accepted by the Product Owner at the Day 13 review.
**Realised commitment:** 44 SP planned, 44 SP completed.

---

## Day 0 (joint refinement, before sprint)

Sprint 0 retro action #2 honoured: both Scrum Masters held a joint refinement with all three squads.
- Confirmed S1-08 Plugin Info panel is a Charlie story consuming the Alpha plugin-loader's `/v1/plugins`.
- Confirmed S1-07 affiliation rendering depends only on the v0 track payload field `app6d_sidc`; no contract change required for this sprint.
- Compliance Officer confirmed the Sprint 1 plugin matrix entries.

## Day 1 — Planning + Kickoff

- Sprint goal locked. Capacity 116 person-days; commitment 44 SP held.
- Tech Lead time-boxed a 4-hour spike on the gRPC SDK contract (S1-01). Outcome: contract drafted and reviewed before end of day; ADR-002 unchanged.
- Cohort-cycle calendar reviewed (will-scrum-master-bravo). One window relevant within the next 12 weeks (DIANA next intake); NIF teaser one-pager queued for Day 12.
- Sprint 0 retro action #3 (faster security review loop) introduced as an SLA on the impediments log: 24 h for any schema/crypto/auth/audit-touching PR.

## Day 2

- **S1-01** — Contract committed (`will/sensor/v1/sensor.proto`); `buf lint` passes; `contracts/README.md` written.
- **S1-04** — CoT decoder skeleton + first three test cases. Fuzz harness wired.
- **S1-09** — Tutorial outline approved by Backend Plugins-1; Tech Writer drafts the English text.
- Stand-up flag (Frontend Cesium): Sprint 0 flicker fix needs a regression test for reconnect logic to avoid breaking S0-05 acceptance. Logged.

## Day 3

- **S1-02** — Reference echo plugin runnable end-to-end as a stdout emitter; container builds clean.
- **S1-03** — Plugin loader skeleton: registry package + tests; loader package + happy-path test.
- **S1-04** — XXE defence added; oversize input rejection added; out-of-range coord tests added.
- Tablet logistics (S1-06): CCOSIC SME confirmed delivery of an ATAK-MIL tablet to the lab on Day 9.

## Day 4

- **S1-04** — `FuzzDecode` running locally: 30 s yields no crashes after 200 k iterations; CI fuzz step added at 30 s/PR budget.
- **S1-05** — UDP listener + decoder + forwarder wired; first synthetic CoT round-trip succeeds in dev environment.
- **S1-03** — Loader contract-mismatch rejection test passes; coverage 78 % on `loader`, 92 % on `registry`.
- Stand-up: Backend Core-2 starts the auth-token sketch for the loader API; tabled to Sprint 2 after PO conversation (out of Sprint 1 scope).

## Day 5

- **S1-05** — MQTT publish wired in `cmd/atak-mil/main.go`; end-to-end synthetic flow visible on EMQX dashboard.
- **S1-07** — Frontend Cesium widens entity rendering to any source; affiliation colour mapping committed (Frontend APP-6D).
- **S1-08** — Plugin Info panel scaffolded; polling and error states working against a stubbed JSON.
- Cross-squad check-in (both SMs): all critical paths green; field-test risk on track.

## Day 6 — End of week 1

- **S1-09** — English tutorial complete; Romanian translation underway.
- **S1-05** — `cot-replay` synthetic generator committed; compose wiring updated.
- **S1-07** — Cesium first-load flicker fix committed (defer WebSocket connect until first `postRender` event); regression test for reconnect committed.
- End-of-week status to PM: green. One watch item: stress-test the loader registry under 1 000 plugin entries before Sprint 4 (logged for Sprint 2 refinement).

## Days 7–8 — Weekend

## Day 9

- **S1-06** — Tablet on-site at the Faraday cage at 10:00. Walked a 100 m friendly track; rendered correctly in WILL within 2 s. Hostile drag-drop rendered red. PCAP and screen-recording captured. Disconnect-reconnect tolerated cleanly.
- Security Engineer reviewed the loader API and the CoT decoder; one finding (decoder did not bound `<detail>` element nesting). Fix landed same day; new test added to `cot_test.go`.
- Sprint 0 retro action #3 SLA met: schema/auth-touching PRs reviewed within 24 h on every PR this sprint.

## Day 10

- **S1-09** — Romanian translation reviewed by a native-speaker engineer; the tutorial passes the discoverability test (a Bravo engineer who did not write it follows it and ships a working plugin in 38 minutes).
- **S1-08** — Plugin Info panel a11y verified; Lighthouse a11y 100 on the dashboard.
- All PBIs in "ready for review" state by EOD.

## Day 11

- End-to-end dry run from a clean compose tree. All containers green within 70 s (slower than Sprint 0 — added five containers; acceptable). Demo flow exercised end-to-end.
- One Cesium polish item (label collision when both contacts overlap) deferred to Sprint 2 with PO sign-off.

## Day 12

- Demo rehearsal with the PO acting as audience. Procurement framing tightened. NIF teaser one-pager drafted by will-scrum-master-bravo and shared with the PM.
- Final security scan: zero Critical, three High in transitive frontend dependencies (same as Sprint 0; tracked in release notes).
- Cosign signing wired into CI for all five new images (`plugin-loader`, `atak-mil`, `reference-echo`, `cot-replay`, updated `frontend`).

## Day 13 — Sprint Review

Audience: Product Owner, Programme Manager, Tech Lead, Compliance Officer, CCOSIC SME, one operator from a candidate pilot unit.

| PBI | Result |
|---|---|
| S1-01 | **Accepted.** Contract walk-through landed; Tech Lead noted the additive-evolution discipline aloud. |
| S1-02 | **Accepted.** Reference plugin runs; serves as the canonical starter. |
| S1-03 | **Accepted.** Loader API live; coverage above target. |
| S1-04 | **Accepted.** Decoder live; fuzz line in CI confirmed. |
| S1-05 | **Accepted.** Adapter live; `cot-replay` and live tablet feeds both demonstrated. |
| S1-06 | **Accepted.** Field test executed Day 9 with the SME's tablet; PCAP and recording reviewed. |
| S1-07 | **Accepted.** Affiliation colours visible; flicker fix verified on three reference VM types by QA Automation. |
| S1-08 | **Accepted.** Panel updates after a `docker compose restart reference-echo`. |
| S1-09 | **Accepted.** Tutorial walked through; bilingual review confirmed. |

**Operator feedback (pilot-unit invitee):** "We can see ourselves using this on the tablet at Cincu next month. Add the symbology library and we'll evaluate seriously." — Frontend APP-6D notes this as input to Sprint 9 priorities.

**SME feedback (CCOSIC):** "The decoder hardness is encouraging. Make sure the audit trail captures every CoT we ingest by Sprint 11." — Backend Core-2 logs this against Sprint 11.

## Day 14 — Retrospective

Format: 4 Ls (Liked, Learned, Lacked, Longed-for). Three improvement actions for Sprint 2:

1. **Loader registry stress-test before Sprint 4** — QA Automation owns; success measure: 1 000-plugin synthetic registry handled without latency regression by Sprint 2 review.
2. **Cesium label collision** — Frontend APP-6D owns; success measure: clustering or collision-aware label placement by Sprint 2 review.
3. **NIF teaser one-pager review with the PM** — will-scrum-master-bravo owns; success measure: PM-approved version by Sprint 2 Day 3, ready for the next NIF deal-flow window.

Procurement-cycle look-ahead: DIANA cohort window opens before Sprint 4. Sprint 2 (white-label admin + MAVLink) sharpens the pitch; Sprint 4 (LoRa + RBAC) completes it.

---

## Outputs handed to Sprint 2

- A working ATAK-MIL pipeline (synthetic and live).
- A versioned Plugin SDK contract and a tested loader.
- A reference plugin and a discoverable bilingual tutorial.
- A Plugin Info panel and updated dashboard with affiliation rendering.
- An updated procurement classification matrix and a NIF teaser one-pager draft.
- Three Sprint-2 improvement actions out of the retrospective.
