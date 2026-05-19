# War-Games Training Module — Architecture

ADR-013. Inspiration: **wargame-nexus** (github.com/zardus/wargame-nexus) —
a progression hub of curated challenges with difficulty tiers,
prerequisite gating, badges and a leaderboard — applied to WILL
C2-operator training; **Lattice-style** — the same operator UI as live,
run in a scenario / mission-rehearsal mode, ending in a graded debrief.

## The boundary (read this first)

Training is **EXERCISE-isolated**. The `trainer` service has **no route**
that posts a threat, track, engagement, friendly asset, platform state, or
coordination measure into the live BMS / BFT / fires / ownship services.
It orchestrates *which scenario is active* and *scores reported outcomes*.
Every run carries an `exercise_id`; the operator UI shows a persistent
amber **TRAINING / EXERCISE** banner whenever a run is RUNNING or PAUSED.
`api_test.go::TestNoLiveInjectionRoutes` asserts the prohibited routes do
not exist.

## Progression model

```
Tier 1   first-light ──▶ cincu-gmti-drill
                                  │
Tier 2            ┌──── black-sea-swarm ────┐
                  │                          │
                  ▼                          ▼
Tier 3      emcon-silent            (with bmd-intercept)
                  │                  tst-under-pressure
                  └──────────┬──────────────┘
Tier 4                       ▼
                      excon-controller
```

A scenario unlocks only when **all its prerequisites are passed** (grade
≠ FAIL). Server-side gating in `POST /v1/runs` refuses a locked scenario
(409) — the UI gating is convenience, the service is the authority.

## Scoring

Each scenario has weighted objectives summing to 100; objectives are
`graded` (0..1 achievement × weight) or `pass_fail` (full weight or zero).
**Hard gate:** any failed `pass_fail` objective forces grade = FAIL and
awards no badge, regardless of numeric score. Bands: PASS ≥ 60, MERIT ≥
75, DISTINCTION ≥ 90 (all require every pass_fail passed). Transparent and
hand-verifiable — same discipline as the BMS threat-scoring doc.

## HTTP surface

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/healthz` | – | declares `mode: exercise-isolated` |
| GET | `/v1/scenarios` | operator | full catalogue |
| GET | `/v1/curriculum?trainee=` | operator | completed / unlocked / locked |
| GET/POST | `/v1/runs` | operator | list / start (server enforces gating) |
| GET | `/v1/runs/{id}` | operator | one run |
| POST | `/v1/runs/{id}/control` | operator | EXCON: start \| pause \| resume \| abort |
| POST | `/v1/runs/{id}/complete` | **admin** | record outcomes → score + grade + badge |
| GET | `/v1/leaderboard` | operator | best completed score per trainee/scenario |

## Scenario library (Romania / Cincu / Black-Sea themed)

| Tier | Scenario | Maps to | Badge |
|---|---|---|---|
| 1 | First Light — Operator Basics | COP, layers, classification | WILL Operator Basic |
| 1 | Cincu GMTI Drill | STANAG 4607 (Sprint 3) | – |
| 2 | Black Sea Swarm | BMS + BFT + fires deconfliction | Air Defence Operator |
| 2 | BMD Intercept | BMS air-defence expansion (Patriot/ballistic) | – |
| 3 | EMCON SILENT | ownship + Sprint-5 offline-first edge | Maritime Operator |
| 3 | TST Lane Under Pressure | BMS TST + AAR | – |
| 4 | EXCON Controller | white-cell control of a cohort | EXCON Controller |

## Demo (demo-ux Training view)

Tiered catalogue with locked/unlocked gating, an active-run panel with
EXCON controls (pause/resume/abort) and clean/partial completion, a graded
debrief with per-objective breakdown, earned badges, and a leaderboard
note. A global amber EXERCISE banner appears across the whole shell while a
run is active so the synthetic picture can never be confused with live.
