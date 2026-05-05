# Sprint 0 — Execution Log

**Sprint window:** [Insert real dates at planning]
**Facilitator:** will-scrum-master-alpha (will-scrum-master-bravo on S0-07)
**Outcome:** all nine PBIs accepted by the Product Owner at the Day 13 review.
**Realised commitment:** 39 SP planned, 39 SP completed.

This log records what actually happened, day by day, against the sprint plan. It is the source for the retrospective on Day 14 and for the procurement-readiness backlog inputs to Sprint 1.

---

## Day 1 — Planning + Kickoff

- **Sprint goal locked.** PO and Tech Lead signed off on the goal as written in `sprint-plan.md`.
- **Capacity confirmed.** 108 person-days available; commitment 39 SP held.
- **Risk register seeded** with the six items in §6 of the sprint plan.
- **Day 1 spike:** Tech Lead time-boxed a 3-hour spike on Mythic upstream compose drift. Outcome: drift confirmed; we adopt the **WILL Core stub** strategy (ADR-001) for Sprint 0 and integrate the real fork in Sprint 1. Stub committed by end of day.
- **Cohort-cycle calendar reviewed** (will-scrum-master-bravo). No DIANA / NIF / EDF deadline within the Sprint 0 window; pressure absorbed.

## Day 2

- **S0-01** — DevOps Cloud opened the draft `docker-compose.yml` for `postgres + emqx + flyway + will-core-stub`. Ports mapped, healthchecks added.
- **S0-09** — Tech Lead and Tech Writer drafted ADR-001 and ADR-003. Reviewed in the afternoon huddle.
- **Stand-up flag:** Frontend Tenant-UX raised that they need an i18n approach by Day 4 to avoid blocking S0-07. Logged as critical-path watch.

## Day 3

- **S0-03** — Backend Core-1 wrote `V0001__tracks.sql` and the undo migration. Schema reviewed by Tech Lead and the Compliance Officer (classification column accepted).
- **S0-09** — ADR-002, ADR-004, ADR-005 drafted.
- **CI cluster confirmed available** by DevOps Cloud; no runner contention expected.

## Day 4

- **S0-04** — Backend Plugins-2 implemented `sim-gps-puck` with a circular trajectory over the Cincu range (45.8696°N, 24.7753°E, 1.5 km radius). Classification stub `NESECRET` populated. Integration with EMQX healthy.
- **S0-07** — Frontend Tenant-UX delivered the i18n provider and the bilingual login. Lighthouse a11y on the login page: 97. Full string parity verified.
- **Stand-up flag:** WebSocket bridge (S0-05) starting Day 5; risk that Frontend Cesium will be blocked by Day 7 if S0-05 slips.

## Day 5

- **S0-05** — Frontend Cesium implemented the Node-based bridge with dedup window and `/healthz`. Storm-tested at 100 Hz from a single source: zero loss; back-pressure documented.
- **S0-08** — QA Automation laid down the GitLab CI skeleton with Ruff, ESLint, tsc, Vite build, Trivy, and Grype stages.
- **Cross-squad check** (Bravo/Charlie SM): Plugin SDK design spike (deferred to Sprint 1) does not block any S0 PBI.

## Day 6 — End of week 1

- **S0-02** — Backend Core-1 wired the `will-core-stub` (FastAPI) with `/healthz` and `/version`. Full-fork integration deferred to Sprint 1; ADR-001 carries the rationale.
- **S0-06** — Frontend APP-6D + Frontend Cesium paired on the Cesium globe component, the WebSocket consumer, and the entity tracker. Single moving marker confirmed against the simulated track at 1 Hz.
- **End-of-week status to PM:** all stories on track; one watch item (S0-08 canary needs a deliberately vulnerable image; QA Automation confirmed `vulnerables/web-dvwa` is appropriate and will run as the canary).

## Day 7 — Weekend (no work)
## Day 8 — Weekend (no work)

## Day 9

- **S0-08** — Canary job tested locally. Pulling `vulnerables/web-dvwa` produces multiple Critical CVEs; Trivy correctly fails. Pipeline regression-test passes.
- **S0-06 polish** — APP-6D friendly-land symbol simplified to a blue point with a label; full library deferred to Sprint 9 per the work plan. Snapshot test committed.
- **Security review** of the schema and the plugin happened mid-afternoon. No blockers.

## Day 10

- **S0-09** — All five ADRs accepted. Index updated.
- **Documentation pass** — Tech Writer translated `dev-environment.md` to Romanian; reviewed by a native-speaker engineer. RO/EN parity confirmed.
- **Procurement overlay** committed by the Scrum Masters; reviewed by the Programme Manager.

## Day 11

- **End-to-end dry run.** `docker compose down -v && docker compose up -d` from a clean checkout. All containers green in 47 seconds. Login → dashboard → moving point on the globe verified.
- **Stand-up flag:** Cesium occasionally renders a blank globe on first load on Linux developer VMs. Workaround: reload after 3 seconds. Logged as a Sprint 1 polish item; not a Sprint 0 release blocker.

## Day 12

- **Demo rehearsal** with the PO acting as the audience. Run sheet exercised end-to-end. One reword in the procurement framing slot (will-scrum-master-alpha tightened the language). Backup screencast recorded.
- **Final security scan** on the stack: zero Critical, two High in upstream Cesium dependencies (transitive `protobufjs`); both have upstream patches scheduled for Cesium's next release. Documented as accepted risk in the Sprint 0 release notes.

## Day 13 — Sprint Review

Audience: Product Owner, Programme Manager, Tech Lead, Compliance Officer, one CCOSIC SME.

Run sheet from `demo-script.md` followed verbatim. Outcomes:

| PBI | Result |
|---|---|
| S0-01 | **Accepted.** Stack to green in 47 s on the reference workstation. |
| S0-02 | **Accepted.** Stub healthz and version endpoints reachable; ADR-001 acknowledged. |
| S0-03 | **Accepted.** Schema reviewed live; classification column noted. |
| S0-04 | **Accepted.** Live publish demonstrated; Romanian-marking stub verified. |
| S0-05 | **Accepted.** 100 Hz dedup demonstrated. |
| S0-06 | **Accepted.** Moving icon over Cincu confirmed. |
| S0-07 | **Accepted.** RO/EN toggle exercised; Lighthouse score shown. |
| S0-08 | **Accepted.** Canary failed correctly. |
| S0-09 | **Accepted.** ADR index walked through. |

**SME feedback (CCOSIC):** "Foundations look right. Bring real CoT in Sprint 1; we will provide an ATAK-MIL endpoint for the field test."

**PO acceptance:** all nine.

## Day 14 — Retrospective

Format: sailboat (per `retrospective.md`). Selected three improvement actions for Sprint 1:

1. **Cesium first-load flicker** — Frontend Cesium owns; success measure: zero flicker on three reference VM types by Sprint 1 review.
2. **Cross-squad refinement timing** — Both SMs own; success measure: one joint refinement scheduled before Sprint 1 Day 1.
3. **Faster security review loop** — Security Engineer + both SMs; success measure: schema and crypto-touching PRs reviewed within 24 h.

Procurement-cycle look-ahead: nothing imminent; Plugin SDK Sprint 1 output positions us for the next DIANA cohort window.

---

## Outputs handed to Sprint 1

- A green stack and a documented bring-up procedure (RO + EN).
- A working reference plugin and a published v0 track schema (`docs/contracts/track-v0.json` to be formalised in Sprint 1 ADR refresh).
- A signed-off ADR set establishing C2 core, Plugin SDK transport, system of record, deployment toolchain, and classification metadata.
- A CI policy that physically prevents shipping a Critical CVE.
- A demo recording and the SME's commitment to provide an ATAK-MIL endpoint for Sprint 1 field test.
