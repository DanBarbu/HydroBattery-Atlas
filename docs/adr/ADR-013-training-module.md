# ADR-013 — War-games Training module (EXERCISE-isolated)

- Status: Accepted
- Date: (post analysis modules A–D)
- **Co-signed: Tech Lead · Compliance Officer**; Consulted: Security Engineer, both Scrum Masters (training delivery), Product Owner

## Context

Operators need to train on WILL the way they will fight on it. Two public
models inform the design:

- **wargame-nexus** (github.com/zardus/wargame-nexus): a *progression hub*
  of curated challenges — difficulty tiers, prerequisite gating, badges,
  a leaderboard. We apply that structure to C2-operator training.
- **Lattice-style training**: the *same operator UI* as live ops, run in a
  scenario / mission-rehearsal mode, ending in an after-action review
  (we already have the BMS AAR concept — ADR-009/extensions).

## Decision

Add a `trainer` service plus a Training view. It provides a curated
scenario **catalog** with prerequisite-gated **curriculum** progression,
scored **runs**, **badges**, and a **leaderboard** — Romania/Cincu/Black-Sea
themed and mapped onto the modules already built (BMS, BFT, naval, fires,
edge).

### The boundary (the reason this needs an ADR)

Training data is **EXERCISE-isolated**. Concretely and enforced:

1. Every run carries a generated `exercise_id`; everything attributable to
   a run is exercise-flagged.
2. The `trainer` service has **no route that posts threats, tracks,
   engagements, or any entity into the live BMS / BFT / fires / ownship
   services.** It orchestrates *which scenario is active* and *scores
   operator actions reported back to it* — it never injects synthetic
   threats into the live pipeline. Synthetic feeds in the demo are the
   existing sim plugins, which are already exercise-grade.
3. The operator UI shows a persistent **TRAINING / EXERCISE** banner
   whenever a run is RUNNING or PAUSED, distinct from the classification
   banner, so a synthetic picture can never be mistaken for live.
4. Live classification + exercise indicator coexist (STANAG 4607 carries
   an exercise indicator; CoT has one) — training never clears or fakes a
   live marking.

This mirrors the boundary discipline of ADR-008 (coordinator, not
fire-control) and ADR-012 (fires awareness, read-only): the new capability
is powerful precisely because it is unambiguously fenced off.

## Alternatives considered

- *Reuse a live tenant with a "training" flag on entities.* Rejected — one
  missed flag and a synthetic threat sits in the live COP. A separate
  service with no live-injection surface removes the risk class.
- *Build a separate simulator that feeds BMS exercise threats.* Rejected
  for the same reason; the existing sims already provide exercise-grade
  feeds and the trainer must not become an injection path.
- *No progression, just a scenario list.* Rejected — the wargame-nexus
  insight is that prerequisite gating + tiers + badges is what actually
  builds competence and is measurable for certification.

## Consequences

- New `trainer` service (catalog + curriculum + runs + scoring +
  leaderboard) and a demo-ux **Training** view (tiered catalog with
  locked/unlocked gating, EXCON run controls, live objective tracker,
  score + grade + AAR, leaderboard, badges).
- New schema V0013 (`scenarios`, `training_runs`) with ADR-006-shape RLS.
- No new sim plugin, by deliberate boundary choice.
- The BMS AAR concept is reused conceptually for the run debrief; a future
  hook may pull a real BMS AAR into a run score (declared, not built;
  would remain read-only from the trainer's side).
- Sprint-11 ORNISS file references this ADR as the documented control on
  exercise/live separation.

## Status

Delivered. See `docs/training/architecture.md`. The boundary is asserted
by `api_test.go::TestNoLiveInjectionRoutes`.
