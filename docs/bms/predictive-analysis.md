# Predictive Battlefield Analysis

> Sub-module of the BMS service. ADR-009. Built from publicly-documented
> techniques only.

## Purpose

Three operator-facing capabilities:

1. **Track propagation** — answer "where will this threat be in N seconds?"
   for the COP and for engagement-window estimation.
2. **Engagement windows** — for each (track, effector) pair, when does the
   projected track sit inside the effector's kinematic envelope? Operators
   use this to prioritise approvals before the window closes.
3. **Course-of-Action (COA) recommendation** — given the current threat
   list and effector inventory, which threat-effector assignment maximises
   total expected probability of kill? Greedy heuristic; documented.

## API

| Method | Path | Role | Returns |
|---|---|---|---|
| GET | `/v1/predictions/tracks` | operator+ | per-threat 12-waypoint, 120-second projection |
| GET | `/v1/predictions/engagement-windows` | operator+ | one `Window` per (track, effector) pair with `t0`/`t1`/`engageable` |
| GET | `/v1/predictions/coa` | operator+ | ordered `COAStep` list — recommended engagement order with rationale |

## Track propagation

Constant heading + speed model in the local tangent plane of the track's
position. 1-σ position uncertainty grows linearly at 3 m/s (configurable).
The first waypoint is the observation; subsequent waypoints are at
10-second steps out to 120 s.

```
                                         × +90s, 3σ ≈ 33 m + 90 m
                                       /
                                     /
                                   /
                                 ×
                               /
                             /
              observation × ─── projected path ───×
```

The propagator is a coarse first cut. The Sprint 6 fusion engine produces
richer predictions; the BMS displays whichever it has. The package
intentionally keeps the API minimal so the upgrade path is non-breaking.

## Engagement windows

For each propagated waypoint we test whether the projected position sits
inside the effector's `[min_range, max_range]` × `[min_altitude, max_altitude]`
envelope, with the target speed inside `max_target_speed_mps`. Output is the
**first contiguous interval** `[t0, t1]` during which the test holds.

`Window.Engageable = false` when the effector is not READY, has no rounds,
or the projection never enters the envelope.

## COA recommender

Greedy weapon-target assignment:

1. Sort threats by `priority_score` descending.
2. For each threat, pick the highest-PK effector that is READY, has rounds
   remaining, is kind-compatible (the BMS pairing table — Patriot for
   cruise, NSM for surface, C-UAS for swarm/uav_one_way, …), and within
   range / altitude / speed envelope.
3. Decrement the chosen effector's running rounds tally; emit a `COAStep`.
4. If no effector qualifies, emit a step with `effector_id = ""` and the
   rationale string "no compatible effector with rounds remaining".

Greedy is optimal in many tactical cases and always defensible to an
operator. The package is structured so the greedy solver can be replaced
with a Hungarian-algorithm exact solver in a future release without
changing the API or the UI.

## What it does NOT do

- It does not predict target identity. Threat class is supplied by the
  upstream fusion / classification layer.
- It does not output PK with claimed precision. The number is a documented
  best-effort estimate (range-margin closeness × speed penalty) — for
  prioritisation only.
- It does not pretend to be a fire-control predictor. The effector's
  own fire-control system owns the actual interception solution.
- It does not use any proprietary algorithms or data. Every line is
  traceable to a published technique.

## Operator UX

The demo-ux app shows:

- A **dotted projected path** for every hostile/unknown threat, with a
  3-σ uncertainty marker at the horizon.
- A **blue intercept line** from each effector to the predicted impact
  point of every EXECUTING engagement.
- A **Recommended Course of Action** panel listing the COA steps in
  priority order, with PK and rationale, and a "predictive" badge so
  operators always know which numbers come from the BMS coordinator
  versus the effector platform itself.

Toggleable on the globe via the **Predictive paths** layer toggle.
