# Sprint 0 — Sprint Review (Day 13)

**Duration:** 60 minutes total.
**Audience:** Product Owner, Programme Manager, Tech Lead, Compliance Officer (optional), one MApN/CCOSIC SME (invited).
**Facilitator:** will-scrum-master-alpha.
**Demo driver:** rotates by story; Tech Lead handles questions.
**Recording:** yes (consent confirmed at the top); stored unclassified.

---

## Pre-flight checklist (T-30 minutes)

- [ ] Reference workstation booted; demo branch tagged `sprint-0-review`.
- [ ] `docker compose down -v && docker compose up -d` already run; all containers healthy.
- [ ] Browser open at `http://localhost:3000` (login screen).
- [ ] Browser tab 2 at Mythic UI.
- [ ] Browser tab 3 at EMQX dashboard.
- [ ] GitLab CI tab showing the latest green pipeline + the canary failure.
- [ ] Backup recording (5-minute screencast) ready in case live demo fails.

---

## Run sheet

### 0:00 — Introductions and ground rules (3 min)
**Facilitator:** Scrum Master.
- Recap the sprint goal in one sentence.
- State what the audience will see, in plain language.
- "Hold questions until the end of each section. We'll have ten minutes for Q&A at the end."

### 0:03 — From zero to running stack (7 min)
**Driver:** DevOps Cloud.
**Demonstrates:** S0-01.
- Tear down the stack live (`docker compose down -v`).
- Bring it up live (`docker compose up -d`).
- Show all containers healthy in under 60 seconds.
- Open Mythic UI, EMQX dashboard, PostgreSQL via psql.
**Talking point for the SME:** "From a clean checkout to a running C2 development environment in one minute. This is the floor for every later sprint."

### 0:10 — A track on a globe (12 min)
**Drivers:** Backend Plugins-2 (sensor side), Frontend Cesium + APP-6D (rendering).
**Demonstrates:** S0-04, S0-05, S0-06.
- Show the simulated GPS plugin publishing on EMQX (live topic subscription).
- Open the dashboard; show the blue APP-6D friendly-land symbol moving over Cincu range.
- Pause the simulator; the icon stops. Resume; it continues.
- Show the WebSocket bridge logs handling the message flow.
**Talking point for the SME:** "By Sprint 1, the simulator is replaced by a real ATAK-MIL feed. The pipeline is the same."

### 0:22 — Bilingual login (5 min)
**Driver:** Frontend Tenant-UX.
**Demonstrates:** S0-07.
- Show login in English; toggle to Romanian; toggle back.
- Run a Lighthouse accessibility scan live (or pre-recorded if time-pressured).
- Show the i18n JSON files; explain the discipline of "no hard-coded strings."
**Talking point:** "Bilingual is non-negotiable from day one. Retrofitting i18n into a mature UI is a Phase 4 nightmare; we will not put ourselves there."

### 0:27 — Database, schema, classification stub (5 min)
**Driver:** Backend Core-1.
**Demonstrates:** S0-03 (and the classification stub from S0-04).
- Show the `tracks` table; explain the geometry, the JSONB metadata, the `classification` column.
- Insert a sample track with `classification = 'NESECRET'`.
- Show the GIST index in action with `EXPLAIN ANALYZE` on a bounding-box query.
**Talking point for the SME:** "Classification is structural, not bolted on. By Sprint 9 the UI shows banners; today the foundation is there."

### 0:32 — CI fails on a vulnerable container (5 min)
**Driver:** QA Automation.
**Demonstrates:** S0-08.
- Show the green pipeline on `main`.
- Show the canary pipeline that pulls a deliberately vulnerable image and fails.
- Walk through the Trivy + Grype output.
**Talking point:** "We cannot ship a Critical CVE to a customer. The pipeline is now physically incapable of letting that happen."

### 0:37 — Architectural decisions written down (3 min)
**Driver:** Tech Lead.
**Demonstrates:** S0-09.
- Open `docs/adr/`; click through ADR-001 to ADR-005.
- Highlight ADR-005 (STANAG 4774) as the bridge to Sprint 9 and the ORNISS file.
**Talking point:** "These five ADRs are the spine of the architecture. Every later contentious decision either references one or extends one."

### 0:40 — What we did NOT do (2 min)
**Driver:** Scrum Master.
- Read out the §8 list from the sprint plan.
- Reaffirm: "If you wanted any of this in Sprint 0, raise it with the Product Owner; otherwise, see you in Sprint 1."

### 0:42 — Procurement / interoperability framing (3 min)
**Driver:** will-scrum-master-alpha (with cohort-cycle calendar on screen).
- Reference `procurement-overlay.md`: "Sprint 0 produces no funding-bearing artefact directly. It produces the platform skeleton on which Sprint 3 (STANAG 4607), Sprint 14 (FMN Spiral 4), and DIANA / NIF demo material will rest."
- Name the next funding-relevant deadline.

### 0:45 — Q&A (10 min)

### 0:55 — Acceptance and close (5 min)
**Driver:** Product Owner.
- For each PBI on the board, the PO reads the title and says "Accepted" or "Rejected, see notes."
- Scrum Master records acceptance in the sprint board.
- Programme Manager confirms next sprint kickoff slot.

---

## Live demo failure protocol

If anything fails during the demo:

1. Scrum Master keeps talking; do not freeze.
2. Switch to the pre-recorded screencast for that section.
3. After the review, file a P1 bug; root-cause it before Sprint 1 planning.

Demo failures are not retro topics for blame; they are retro topics for **why we did not catch this before the audience did**.
