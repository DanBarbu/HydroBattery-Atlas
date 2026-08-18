# Engagement Workflow

> The state machine in `services/bms` and the operator UX in `demo-ux/`.

## State machine

```
                 ┌───────────────┐
                 │   PROPOSED    │  ◀── POST /v1/engagements/propose
                 └───────┬───────┘
                         │  operator(admin)
                         │  POST /v1/engagements/:id/approve
                         ▼
                 ┌───────────────┐
                 │  EXECUTING    │  ◀── effector accepts (will.effector.v1)
                 └───────┬───────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
        COMPLETED    ABORTED   REJECTED
        (effector)  (operator) (effector / safety)
```

WILL is a coordinator. The operator authority gate is **APPROVED**; the
effector reports **COMPLETED** through the `will.effector.v1` engagement
stream.

## Weapon-target pairing rules

Documented in `internal/pairing/pairing.go`. An effector is a candidate when:

1. `status == "READY"`
2. `rounds_remaining > 0`
3. target speed `<= max_target_speed_mps`
4. target altitude in `[min_altitude_m, max_altitude_m]`
5. slant range in `[min_range_m, max_range_m]`
6. effector kind compatible with the threat class (e.g. C-UAS will not pair
   with a ballistic threat)

Among candidates, WILL prefers the effector with the largest range margin
(most slack inside the envelope), ties broken by rounds remaining.

## Worked example (demo seed)

Two effectors seeded at boot:

| Effector | Kind | Location | Range envelope | Max target speed | Rounds |
|---|---|---|---|---|---|
| Patriot Bn 1 | sam_area | 45.87°N 24.78°E | 3–80 km, 50 m – 25 km altitude | 2 400 m/s | 8 |
| NSM Coastal Bty | nsm_coastal | 44.20°N 28.65°E | 3–200 km, -10 m – 5 km altitude | 700 m/s | 4 |

Submit a hostile cruise missile near Cincu via `/v1/threats/score` then
propose an engagement. Pairing selects Patriot Bn 1; PK is estimated at ~0.7
in the middle of the envelope.

Submit a hostile fast attack craft near Constanța; pairing selects NSM
Coastal Bty (the only effector compatible with `threat_class=surface`).

## Audit trail

Every transition writes a row in `engagements` (or, in the demo, an update
to the in-memory record). The operator UX renders the proposed/approved/
completed timestamps; the auditor role can list every engagement for a
tenant and reconstruct the timeline.

## What the operator sees (demo-ux)

- **Threat board** — sorted by priority score; high-priority threats in red.
- **Effector board** — status pill, rounds, kinematic envelope summary.
- **Engagement queue** — running list; one-click **Propose** on a threat,
  one-click **Approve** / **Abort** on a proposal, one-click **Complete**
  on an executing engagement to simulate the effector's return.

## What the operator does NOT see

- Real interceptor guidance.
- Real radar tasking.
- Live PK refinement from the fusion engine (Sprint 6+).
- Cross-tenant analytics (auditor role required; demo doesn't model that
  separately).
