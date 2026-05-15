# ADR-009 — Predictive Battlefield Analysis as a BMS sub-module

- **Status:** Accepted
- **Date:** Post-ADR-008
- **Decider:** Tech Lead, with Backend Core-1, Backend Plugins-1, Sensor Fusion Engineer
- **Consulted:** Product Owner, Compliance Officer, Security Engineer

## Context

ADR-008 established the BMS module as a coordinator: scoring, pairing,
engagement state machine. Operators consistently asked for one more class
of question: **"what is about to happen?"** — projected paths,
engagement windows opening or closing, recommended engagement order under
constrained munitions.

This is a recognisable capability area in publicly-documented battle-
management platforms (Sita-Ware, ADVENT, Fortion IBMS, SBMS); the public
material describes it generally as automated decision support, single-
consciousness multi-sensor fusion, and rule-based recommendation engines.

## Decision

We add a sub-module `services/bms/internal/prediction/` providing:

- `Propagate(track, steps, dt)` — forward-projection of a track's
  position with linearly-growing 3-σ uncertainty.
- `EngagementWindow(track, effector, waypoints)` — first contiguous
  interval the projection sits inside the effector's envelope.
- `Density(aoi, rows, cols, scoredPropagations)` — coarse threat-density
  grid for the COP overlay.
- `COA(input)` — greedy weapon-target assignment that maximises total
  expected probability of kill while respecting per-effector rounds
  remaining.

Three new HTTP routes on the BMS service:
- `GET /v1/predictions/tracks`
- `GET /v1/predictions/engagement-windows`
- `GET /v1/predictions/coa`

The demo-ux app consumes equivalent in-memory mocks and renders dotted
projected paths, intercept geometry on EXECUTING engagements, and a COA
recommendation panel.

## Important provenance and limits

**Public information only.** The package is built from publicly-documented
techniques (constant-velocity propagation, range-altitude-speed envelope
checks, greedy weapon-target assignment). No proprietary code, datasets,
weights, or trade secrets from any commercial peer were used.

**Coordinator boundary unchanged (ADR-008).** The propagator and the
window estimator are situation-awareness aids for the operator, not
fire-control predictors. The effector platform owns the actual
interception solution and the kinetic decision.

**Documented heuristic, not a black box.** Every produced number has a
rationale string the operator can read. The Sprint 11 ORNISS pre-
accreditation file references this ADR as the documented control for the
recommender behaviour.

## Alternatives considered

- **Inline the recommender in the existing scoring/pairing packages.**
  Rejected. The recommender consumes both packages and adds round
  accounting; keeping it separate lets us swap in a Hungarian exact
  solver without touching score or pairing.
- **Defer to the Sprint 6 fusion engine.** Rejected. The fusion engine
  produces richer predictions; the BMS coordinator still needs a coarse
  predictor for engagement-window estimation against effector envelopes.
  When fusion ships, the BMS consults it; the BMS predictor remains as
  a safe fallback.
- **Probabilistic occupancy grids / particle filters.** Rejected for
  Sprint 5/6 scope; the implementation simplicity of the linear
  propagator outweighs the extra fidelity for operator use.

## Consequences

- The BMS service depends on no new external libraries — the predictor is
  pure-Go with stdlib `math` and `time`.
- The demo-ux app's BMS view grows a "Recommended COA" panel; operator
  experience for "what is the system advising right now?" is direct.
- Sprint 6 fusion-engine work has a clean integration point: replace
  `prediction.Propagate` with a fusion-derived projection while keeping
  the same Window / COA / Density API surface.
- The Sprint 11 ORNISS file gains a documented decision-aid component.

## Verification

- Unit tests cover propagation correctness (heading 90 → eastward),
  uncertainty growth, window finding, density bucketing, and greedy COA
  assignment with constrained rounds.
- The demo-ux app exercises the end-to-end UX: dotted projected paths,
  intercept geometry, COA panel.
