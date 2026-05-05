# Sprint 0 — Sprint Plan

**Facilitator:** will-scrum-master-alpha (with will-scrum-master-bravo on S0-07)
**Product Owner:** will-product-owner
**Tech Lead:** will-tech-lead
**Duration:** 14 calendar days, 10 working days
**Sprint window:** [Insert dates at planning]

---

## 1. Sprint Goal

> A single `docker compose up` command brings up the WILL Romania development environment — Mythic core, EMQX bus, PostgreSQL/PostGIS, simulated GPS sensor, WebSocket bridge, and a CesiumJS dashboard rendering a moving APP-6D friendly track. A bilingual (RO / EN) login screen gates the dashboard. CI fails on a deliberately vulnerable container.

**Why this goal.** Sprint 0 establishes the spine. Every later sprint plugs into the bus, the database, the dashboard, or the CI pipeline laid down here. A demo on Day 13 with a moving track on a globe is the smallest credible artefact we can show MApN and CCOSIC; it sets the tone that this team ships running software, not slideware.

**Procurement-aligned framing (from `procurement-overlay.md`):** Sprint 0 produces the platform skeleton needed for any later eligibility claim under SAFE, EDF, or DIANA. No Sprint 0 deliverable is itself funding-bearing, but every later deliverable depends on this skeleton being clean.

---

## 2. Capacity

| Engineer | Role | Available days | Notes |
|---|---|---|---|
| Backend Core-1 | Squad Alpha | 9 | 1 day annual leave |
| Backend Core-2 | Squad Alpha | 10 | Pairs with Security Engineer on auth foundation |
| Backend Plugins-1 | Squad Bravo | 10 | Drives Plugin SDK kick-off (deferred to Sprint 1, but design spike here) |
| Backend Plugins-2 | Squad Bravo | 10 | Owns the simulated GPS plugin in this sprint |
| Frontend APP-6D | Squad Charlie | 10 | Owns map symbol rendering |
| Frontend Cesium | Squad Charlie | 10 | Owns Cesium init and the WebSocket consumer |
| Frontend Tenant-UX | Squad Charlie | 10 | Owns the bilingual login |
| DevOps Cloud | Squad Alpha support | 10 | Owns docker-compose; advises on later Helm |
| DevOps On-Prem | Squad Alpha support | 5 | Half-time; air-gap mirror prep |
| Security Engineer | Cross-cutting | 8 | Reviews auth foundation; owns CI scan policy |
| QA Automation | Cross-cutting | 10 | Owns CI test scaffolding |
| Tech Writer | Cross-cutting | 6 | First five ADRs polished and translation memory bootstrap |

**Total available:** 108 person-days. Historical first-sprint efficiency assumed at 60 % (new team forming): **planned commitment ≈ 65 person-days of focused PBI work**. Slack absorbs onboarding, environment friction, and the inevitable Day-1 chaos.

---

## 3. Sprint Backlog

Story-point scale: Fibonacci. 1 SP ≈ half a developer-day.

### S0-01 — One-command stack startup
**Owner:** DevOps Cloud
**Estimate:** 5 SP
**Acceptance:**
- `docker compose up -d` brings up Mythic, EMQX, PostgreSQL/PostGIS, the WebSocket bridge, and the React dashboard.
- All containers report healthy in under 60 seconds on a reference workstation (16 GB RAM, 4 vCPU).
- `docker compose down -v` cleanly tears down all volumes and networks.
- README in `docs/setup/dev-environment.md` (RO + EN).
**Dependencies:** None.
**Risks:** Mythic's upstream compose has drifted; expect 0.5 day to align.

### S0-02 — Mythic core operational with database and broker
**Owner:** Backend Core-1
**Estimate:** 5 SP
**Acceptance:**
- Mythic UI reachable on `https://localhost:7443`.
- Default admin login works; admin can create a workspace.
- RabbitMQ (or its replacement) connected; PostgreSQL connection healthy.
- Healthcheck endpoint returns 200 within 30 s of cold start.
**Dependencies:** S0-01.
**Risks:** Upstream Mythic auth defaults; Security Engineer must review before merge.

### S0-03 — PostGIS schema for tracks
**Owner:** Backend Core-1
**Estimate:** 3 SP
**Acceptance:**
- Flyway migration `V0001__tracks.sql` creates a `tracks` table with: `id`, `tenant_id`, `source`, `geometry` (POINT, SRID 4326), `altitude_m`, `heading_deg`, `speed_mps`, `classification`, `observed_at`, `received_at`, `metadata` (JSONB).
- GIST index on `geometry`, BTREE on `(tenant_id, observed_at DESC)`.
- Migration is reversible (`V0001__tracks_undo.sql`).
- Schema reviewed by Tech Lead and Security Engineer (classification column).
**Dependencies:** S0-01.

### S0-04 — Simulated GPS plugin (Python)
**Owner:** Backend Plugins-2
**Estimate:** 5 SP
**Acceptance:**
- Plugin publishes a track at 1 Hz on EMQX topic `telemetry/gps/sim01`.
- Payload schema documented in `docs/contracts/track-v0.json` (subject to Sprint 1 promotion to gRPC).
- Configurable trajectory (default: a circle over Cincu range).
- Containerised; runs from the same compose file.
- Includes a STANAG 4774 metadata stub `classification = "NESECRET"`.
**Dependencies:** S0-01.

### S0-05 — WebSocket bridge
**Owner:** Frontend Cesium
**Estimate:** 5 SP
**Acceptance:**
- Service consumes EMQX `telemetry/gps/+`; dedups by `(source, observed_at)`.
- Emits JSON messages on `ws://localhost:7000/tracks`.
- Tested with a 100 Hz storm (single-source spam): no message loss; back-pressure documented.
- Healthcheck endpoint.
**Dependencies:** S0-01, S0-04.

### S0-06 — CesiumJS dashboard with APP-6D friendly icon
**Owner:** Frontend APP-6D + Frontend Cesium (pair)
**Estimate:** 8 SP
**Acceptance:**
- React SPA at `http://localhost:3000` shows a 3D Cesium globe centred on Romania.
- A blue rectangle (APP-6D friendly land unit, simplest variant) moves at 1 Hz to match the simulated track.
- Frame rate stays above 50 fps with a single track on the reference machine.
- Snapshot test for the symbol; visual regression baseline committed.
**Dependencies:** S0-05.

### S0-07 — Bilingual i18n (RO/EN) login screen
**Owner:** Frontend Tenant-UX
**Facilitating SM:** will-scrum-master-bravo (Charlie support)
**Estimate:** 3 SP
**Acceptance:**
- Login screen renders a language toggle (RO / EN, default EN).
- Toggling language switches all visible strings, including error messages.
- Strings sourced from `i18n/{ro,en}.json` only — no hard-coded copy in components.
- Lighthouse accessibility score ≥ 95 on the login page.
**Dependencies:** S0-01.

### S0-08 — GitLab CI scaffolding with Trivy and Grype
**Owner:** QA Automation + DevOps Cloud
**Estimate:** 3 SP
**Acceptance:**
- `.gitlab-ci.yml` runs: lint → unit tests → container build → Trivy scan → Grype scan.
- Pipeline fails on a Critical CVE; warns on a High; passes on Medium.
- A canary job pulls a deliberately vulnerable image (e.g., `vulnerables/web-dvwa`) and the pipeline must fail; this is the regression for the policy itself.
- Pipeline runs in under 10 minutes on green.
**Dependencies:** S0-01.

### S0-09 — Architectural Decision Record (ADR) repo
**Owner:** Tech Lead + Tech Writer
**Estimate:** 2 SP
**Acceptance:**
- `docs/adr/` directory with the MADR template.
- First five ADRs drafted and reviewed:
  1. ADR-001 Adopt Mythic as the C2 core (forked).
  2. ADR-002 gRPC as the Plugin SDK transport.
  3. ADR-003 PostgreSQL + PostGIS as the system of record.
  4. ADR-004 Helm + Terraform as the deployment toolchain.
  5. ADR-005 STANAG 4774 as the canonical classification metadata.
- Index file lists all ADRs by status.
**Dependencies:** None.

---

## 4. Total commitment

| Story | SP |
|---|---|
| S0-01 | 5 |
| S0-02 | 5 |
| S0-03 | 3 |
| S0-04 | 5 |
| S0-05 | 5 |
| S0-06 | 8 |
| S0-07 | 3 |
| S0-08 | 3 |
| S0-09 | 2 |
| **Total** | **39 SP ≈ 78 dev-half-days** |

Below the 65-day commitment line — deliberate. First sprint, forming team, hardware-and-environment friction expected.

---

## 5. Dependency map

```
S0-01 (compose) ──┬─> S0-02 (Mythic)
                  ├─> S0-03 (Postgres schema)
                  ├─> S0-04 (sim GPS) ──> S0-05 (WebSocket bridge) ──> S0-06 (Cesium)
                  ├─> S0-07 (bilingual login)
                  └─> S0-08 (CI)
S0-09 (ADRs) — independent
```

Critical path: **S0-01 → S0-04 → S0-05 → S0-06**. If S0-01 slips by a day, the whole chain slips.

---

## 6. Sprint risks (from will-scrum-master-alpha's impediments log)

| Risk | Likelihood | Mitigation |
|---|---|---|
| Mythic upstream compose drift | Medium | Tech Lead time-boxes a 0.5-day spike Day 1 |
| Cesium rendering perf on Linux dev VMs | Low | Frontend Cesium runs profile early; fallback 2D mode noted |
| New-team forming friction | High | First three days deliberately under-committed; Scrum Master watches for silence in stand-up |
| GitLab CI runner availability | Medium | DevOps Cloud confirms shared runner capacity Day 1 |
| ADR alignment debates eat the sprint | Medium | Tech Lead time-boxes ADR debates; default to "decide now, revisit at retro" |
| Compliance Officer absent for classification stub review on S0-04 | Low | PO escalates if needed |

---

## 7. Definition of Done (Sprint 0 specific)

For each PBI:
- Code reviewed by at least one peer not on the original pair.
- Unit tests passing in CI; integration tests where applicable.
- Static analysis clean.
- Trivy / Grype: no Critical, no unjustified High.
- SBOM (CycloneDX) generated for any new container.
- Docs updated in the same merge request (RO and EN where the work plan demands).
- Acceptance criteria signed off by the Product Owner.
- Classification metadata reviewed by the Compliance Officer **for S0-03 and S0-04** (the only sprint stories that touch labels).

---

## 8. What is explicitly out of scope for Sprint 0

- The full gRPC Plugin SDK contract — Sprint 1.
- Real hardware — Sprint 1 (ATAK-MIL).
- Multi-tenancy — Sprint 2.
- Classification labels in the UI banner — Sprint 9.
- FIPS-validated crypto — Sprint 10.
- ORNISS pre-accreditation file — Sprint 11.
- Plugin signing — Sprint 12 (registry); Cosign in CI is acceptable from Sprint 2.

If anyone proposes pulling these forward, the Scrum Master defers to the Product Owner — and the answer is "no, that's a later sprint."

---

## 9. Sprint kickoff checklist (Day 1)

- [ ] All engineers have laptops, repo access, GitLab access, EMQX dashboard credentials.
- [ ] Reference workstation provisioned for the demo on Day 13.
- [ ] Slack / Mattermost channel created for Squad Alpha.
- [ ] Calendar invitations sent for: daily stand-up (Days 2–12), Day 13 review, Day 14 retrospective.
- [ ] Defence SME invited to Day 13 review.
- [ ] PO and Tech Lead confirm sprint goal in writing.
- [ ] Risk register seeded with the six items in §6.
