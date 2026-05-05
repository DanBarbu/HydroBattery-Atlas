# Sprint 2 — Execution Log

**Sprint window:** [Insert real dates at planning]
**Facilitators:** will-scrum-master-bravo (lead), will-scrum-master-alpha (Alpha + tenants schema)
**Outcome:** all six PBIs accepted by the Product Owner at the Day 13 review.
**Realised commitment:** 32 SP planned, 32 SP completed.

---

## Day 0 — Joint refinement

Both Scrum Masters held a joint refinement (Sprint 0 retro action #2 still honoured).
- Confirmed S2-04 frontend track icon overrides depend only on the tenant theme JSONB; no contract change.
- Confirmed S2-02 backend exposes a permissive CORS in dev; production lockdown in Sprint 4.
- Compliance Officer pre-ratified the Sprint 2 plugin matrix.

## Day 1 — Planning + Kickoff

- Sprint goal locked. Capacity 119 person-days; commitment 32 SP held.
- Sprint 1 retro carry-overs scheduled: stress test (Day 4), label collision (S2-04 acceptance), NIF teaser (Day 3).
- Tech Lead confirmed no new ADR required this sprint — work fits ADR-002 (gRPC SDK), ADR-003 (PostgreSQL+PostGIS), ADR-005 (STANAG 4774 not in theme).
- Cohort-cycle calendar reviewed: DIANA window 10 weeks out; pitch deck draft kicks off end of sprint.

## Day 2

- **S2-01** — V0002 migration committed; Flyway runs clean against the dev DB; default tenant seeded.
- **S2-03** — pymavlink wired; first HEARTBEAT visible.
- **S2-05** — DevOps Cloud confirms GitLab OIDC integration available on protected runners; key-based fallback documented.

## Day 3

- **S2-02** — tenant-admin Go service skeleton with `store` package; tenant CRUD passes unit tests.
- **NIF teaser one-pager** drafted by will-scrum-master-bravo and approved by PM (carry-over #3 closed).
- **S2-03** — Synthetic GLOBAL_POSITION_INT round-trip works; track payload published to EMQX.

## Day 4

- **Loader stress test** committed (carry-over #1 closed). `TestStress1000Plugins`: List() ~1.2 ms at 1 000 entries on dev hardware. Concurrent test passes under -race.
- **S2-02** — Frontend `Admin.tsx` fetches and renders tenant list; theme editor stores valid JSON; PATCH round-trip works.
- **S2-04** — Frontend Cesium picks up `theme.affiliationColors` and `theme.bannerLabel`; banner colour driven by `theme.primaryColor`.

## Day 5

- **S2-04** — Cesium label collision fix shipped (carry-over #2 closed): distance-display condition + scale-by-distance. 30-track stress shows readable labels at all altitudes; verified by QA Automation on three reference VM types.
- **S2-05** — `cosign-sign` CI stage drafted; first signed image artefact appears on a protected-branch run.
- **Security review:** tenant-admin API reviewed. One finding: PATCH should validate that `theme` is an object before accepting (not an array). Fixed same day; test added.

## Day 6 — End of week 1

- **S2-06** — Theming guide RO/EN drafted; English reviewed.
- **S2-03** — Bench Pixhawk procured; lab test scheduled Day 9.
- **End-of-week status to PM:** green. One watch item: GitLab Cosign keyless requires a small cluster admin tweak; alternative path via `COSIGN_PRIVATE_KEY` already validated.

## Days 7–8 — Weekend

## Day 9

- **S2-03** — Bench Pixhawk test passes. Real autopilot's HEARTBEAT and GLOBAL_POSITION_INT recognised; correct `mav_type` (QUADROTOR) drives APP-6D dimension to A. Track appears on the WILL globe.
- **S2-05** — Cosign keyless wired; `cosign verify` reproduces locally.
- **S2-06** — Romanian translation reviewed by a native-speaker engineer.

## Day 10

- All PBIs in "ready for review" state by EOD.
- Compose updated to wire `tenant-admin`, `mavlink`, `mavlink-sim`; healthchecks green.

## Day 11

- End-to-end dry run from a clean tree. Stack green within 75 s. Demo flow exercised end-to-end, including the bench Pixhawk segment.
- One UX polish (Admin tenant-list keyboard shortcut) deferred to Sprint 3 with PO sign-off.

## Day 12

- Demo rehearsal with PO acting as audience. Procurement framing tightened. PM circulated the NIF teaser to two contacts before the Day 13 review.
- Final security scan: zero Critical, three High in transitive frontend dependencies (no change since Sprint 1).
- All new images Cosign-signed in CI.

## Day 13 — Sprint Review

Audience: PO, PM, Tech Lead, Compliance Officer, CCOSIC SME, candidate pilot operator, one industry-partner integrator (Aerostar).

| PBI | Result |
|---|---|
| S2-01 | **Accepted.** |
| S2-02 | **Accepted.** Live rebrand visible within the 60 s poll; theme JSON validation surfaced cleanly when an array was attempted. |
| S2-03 | **Accepted.** Synthetic and bench Pixhawk feeds both rendered; audience appreciated the two-tier autonomy story. |
| S2-04 | **Accepted.** Affiliation colours overridden live; label collision fix demonstrated at multiple altitudes. |
| S2-05 | **Accepted.** Cosign keyless verified against a freshly published image. |
| S2-06 | **Accepted.** Theming guide walked through; bilingual reviewed. |

**Industry-partner feedback (Aerostar):** "If we white-label this for a forthcoming UAS programme bid, we need terminology overrides applied to the Plugin Info panel too. That's not in Sprint 2 but please add it to Sprint 3 if you can." — will-product-owner logs this as a Sprint 3 candidate.

**Operator feedback (pilot unit):** "Bench Pixhawk test was the most convincing thing in the demo. Schedule a Cincu range test as soon as you can." — will-qa-hil logs this for Sprint 4 (logistics already moving).

**SME feedback (CCOSIC):** "MAVLink is good. When does Link-16 land?" — Sprint 1 already on roadmap; will-backend-tdl confirms Sprint 8.

## Day 14 — Retrospective

Format: Glad / Sad / Mad. Three improvement actions for Sprint 3:

1. **Tenant terminology overrides applied to Plugin Info panel** — Frontend Tenant-UX owns; success measure: terminology map applied in the panel by Sprint 3 review (Aerostar ask).
2. **Per-tenant DB compartment design ADR** — Tech Lead owns; success measure: ADR-006 drafted before Sprint 3 Day 5 (informs Sprint 3 STANAG 4607 work).
3. **Air-gap mirror procedure for new images** — DevOps On-Prem owns; success measure: documented by Sprint 3 Day 3; rehearsed end of Sprint 3.

Procurement-cycle look-ahead: DIANA pitch deck draft starts now; Sprint 3 (STANAG 4607) sharpens the sensing track narrative.

---

## Outputs handed to Sprint 3

- Multi-tenant white-label admin live; theme overrides applied end-to-end.
- MAVLink UAV pipeline live (synthetic + bench Pixhawk).
- All container images Cosign-signed in CI.
- Theming guide RO/EN.
- NIF teaser one-pager circulating.
- Three Sprint-3 improvement actions out of the retrospective.
