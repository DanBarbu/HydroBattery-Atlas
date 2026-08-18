# Sprint 3 — Execution Log

**Sprint window:** [Insert real dates at planning]
**Facilitators:** will-scrum-master-alpha (lead), will-scrum-master-bravo (Charlie + air-gap)
**Outcome:** all five PBIs accepted by the Product Owner at the Day 13 review.
**Realised commitment:** 34 SP planned, 34 SP completed.

---

## Day 0 — Joint refinement

Both Scrum Masters held a joint refinement (cadence sustained from Sprint 0).
- Confirmed S3-01 ships the **WILL minimal profile** of STANAG 4607: header + Mission + Dwell with a fixed existence mask. Backend TDL drafted the package-level documentation.
- Confirmed S3-04 generator and decoder share one source of truth (encoder lives next to decoder).
- Confirmed Plugin Info terminology overrides apply only to user-visible strings, never to system-canonical fields like `track_kind`.

## Day 1 — Planning + Kickoff

- Sprint goal locked. Capacity 124 person-days; commitment 34 SP held.
- Tech Lead reserved Days 4–5 for ADR-006 review.
- Cohort-cycle calendar reviewed: DIANA window 8 weeks out; EDF disruptive-tech ~3 months. Sprint 3 outputs go on the pitch deck.

## Day 2

- **S3-01** — Header + Mission segment decode passing first tests. Fuzz harness wired.
- **S3-03** — V0003 migration committed; Flyway runs clean against dev DB.
- **Air-gap procedure** drafted by DevOps On-Prem; first review by Security Engineer.

## Day 3

- **S3-01** — Dwell segment decode + encode round-trip green; ExistenceMask mismatch rejection works.
- **S3-02** — Plugin skeleton: UDP listener + decode → log; MQTT publish landing tomorrow.
- **S3-05** — Frontend GMTI rendering branch sketched.

## Day 4

- **S3-01** — All decoder unit tests + fuzz green; coverage 88 % on the package.
- **S3-02** — MQTT publish wired; end-to-end synthetic flow visible in EMQX.
- **ADR-006** drafted; Security Engineer + Compliance Officer reviewed; accepted.

## Day 5

- **S3-04** — `gmti-replay` Go service committed; sends three target reports per second.
- **S3-05** — GMTI distinct rendering and layer toggle live; bilingual layer labels.
- **Plugin Info terminology** override implemented; round-trip with a `{"plugin": "modul"}` override behaves correctly.

## Day 6 — End of week 1

- **Air-gap procedure** rehearsal scheduled Day 11; STS POC confirmed Day 12 attendance.
- **End-of-week status to PM:** green. Watch item: real RAT-31DL access at Cincu deferred to Sprint 5 (PO approves).

## Days 7–8 — Weekend

## Day 9

- **S3-04** — Field test plan executed in Faraday cage with synthetic generator. PCAP and screen-recording captured. All pass criteria met.
- **Procedure rehearsal** dry-run with the Compliance Officer playing the ORNISS POC role (STS POC was double-booked). Two-person rule honoured.
- One finding from the rehearsal: the bundle's `manifest.json` did not include image creation timestamps. Fixed same day.

## Day 10

- All PBIs in "ready for review" state by EOD.
- Compose updated to wire `gmti` and `gmti-replay`; healthchecks green.
- README updated to reflect new directories.

## Day 11

- End-to-end dry run from a clean tree. Stack green within 80 s (added two services since Sprint 2; acceptable).
- Air-gap procedure rehearsal repeated with the **real** STS POC; ledger row signed; approved.

## Day 12

- Demo rehearsal with PO acting as audience. Security Engineer rehearsed the air-gap segment.
- DIANA pitch deck refreshed with Sprint 3 STANAG 4607 bullet by will-scrum-master-bravo; PM circulated.
- Final security scan: zero Critical, three High in transitive frontend dependencies (no change since Sprint 1; logged).
- All new images Cosign-signed.

## Day 13 — Sprint Review

Audience: PO, PM, Tech Lead, Compliance Officer, CCOSIC SME, candidate-pilot operator, Aerostar, STS DevOps liaison.

| PBI | Result |
|---|---|
| S3-01 | **Accepted.** Decoder walk-through and live fuzz convinced the Tech Lead and the SME. |
| S3-02 | **Accepted.** Synthetic GMTI rendered live; malformed-packet recovery demonstrated. |
| S3-03 | **Accepted.** psql per-kind counts shown live. |
| S3-04 | **Accepted.** Field-test artefacts reviewed; logistics for real RAT-31DL agreed for Sprint 5. |
| S3-05 | **Accepted.** Layer toggle exercised; radial-velocity labels noted by the operator as "exactly the affordance we want for ground-radar work." |

**STS DevOps liaison feedback:** "The air-gap procedure is the first one I've seen from an integrator that I would actually sign. Add a quarterly drill calendar entry and we are good."

**Aerostar feedback:** "Terminology in Plugin Info closes our Sprint 2 ask. For Sprint 4, can RBAC roles be tenant-scoped from day one? We need branch-of-forces separation in our OEM bid." — will-product-owner logs this for Sprint 4 RBAC.

**SME feedback (CCOSIC):** "When does the operator workflow to promote GMTI-Unknown to Friendly/Hostile land?" — will-tech-lead notes Sprint 6.

## Day 14 — Retrospective

Format: 4 Ls. Three improvement actions for Sprint 4:

1. **Quarterly air-gap drill calendar** — DevOps On-Prem owns; success measure: calendar entries created in the customer-shared planning tool by Sprint 4 Day 3.
2. **RLS preview against the shared-DB profile** — Backend Core-2 owns; success measure: a draft RLS policy file committed for review by Sprint 4 Day 5 (preparation for ADR-006 `schema` mode in Sprint 4 work).
3. **Decoder benchmark against a real RAT-31DL capture** — Backend TDL owns; success measure: replay of a customer-supplied PCAP through `gmti` shows zero decode errors by Sprint 4 review.

Procurement-cycle look-ahead: DIANA pitch in 8 weeks; Sprint 4 RBAC + RLS strengthens it materially. PM circulating the refreshed deck this week.

---

## Outputs handed to Sprint 4

- STANAG 4607 GMTI pipeline (synthetic). Real-radar test scheduled for Sprint 5.
- Track schema extended; per-kind queries operational.
- Plugin Info terminology overrides closed.
- ADR-006 accepted; sets the boundary for Sprint 4 RLS work.
- Air-gap mirror procedure signed off and rehearsed twice.
- Three Sprint-4 improvement actions out of the retrospective.
