# Threat-Priority Scoring

> Methodology behind the `priority_score` column in `threats` and the
> response from `POST /v1/threats/score`.

The score is in **[0, 1]**, higher = more urgent. It is a weighted sum of
five components, each itself in [0, 1]. The weights are exposed in code
(`internal/scoring/threat.go`, `DefaultWeights`) and can be overridden at
startup by an integrator.

## Components

| Component | Definition | Sat. point |
|---|---|---|
| **Kinematics** | Linear in target speed, saturating at 900 m/s (~Mach 2.6). | ≥ 900 m/s → 1.0 |
| **Affiliation** | Hostile = 1.0, Unknown = 0.4, Neutral = 0.0, Friendly = 0.0. APP-6D affiliation single character. | — |
| **Heading** | 1.0 when the track's heading bisects the bearing to a defended asset; 0.0 when 180° opposed. Best across all defended assets. | — |
| **Proximity** | Linear in distance to the nearest defended asset, saturating at 50 km. | 0 km → 1.0; ≥ 50 km → 0 |
| **Classification** | Family-based: ballistic 1.0 > cruise 0.9 > swarm 0.75 > UAV one-way 0.6 > aircraft 0.5 > surface 0.3; unknown 0.4. | — |

## Default weights

```
kinematics      0.20
affiliation     0.25
heading         0.15
proximity       0.25
classification  0.15
```

Integrators may override per tenant or per doctrine. Weights need not sum to
1 — the implementation renormalises.

## Worked example

Hostile cruise missile, 5 km north of Cincu HQ, 250 m/s, heading 180° (south,
straight at the asset).

| Component | Value |
|---|---|
| Kinematics | 250 / 900 ≈ **0.28** |
| Affiliation | Hostile = **1.0** |
| Heading | Δ = 0° → **1.0** |
| Proximity | 5 km / 50 km → **0.9** |
| Classification | cruise → **0.9** |

Weighted sum:

```
(0.20·0.28 + 0.25·1.0 + 0.15·1.0 + 0.25·0.9 + 0.15·0.9) / 1.0
≈ (0.056 + 0.25 + 0.15 + 0.225 + 0.135)
≈ 0.82
```

Score ≈ **0.82**. Above the demo dashboard's red-line at 0.6, so the operator
sees it in the urgent band.

## Why publish the methodology

A black-box score is unhelpful in adversarial review. The Sprint 11 ORNISS
pre-accreditation file references this document; auditors can reproduce
every score from the components. Tunable, defensible, deterministic.

## Limits

- The methodology is intentionally simple. Genuine missile-defence priority
  scoring uses kinematic projections and time-to-impact computed from
  predicted intercept envelopes, not a weighted scalar. WILL's score is a
  **first-cut prioritisation** for the operator's attention queue; the
  effector's own fire-control system performs the engagement decision.
- The "defended asset" list is configured per tenant. Real deployments would
  draw it from the customer's defended-asset list (DAL); WILL ships a
  pluggable interface and a default of [Cincu HQ, Constanța naval area] for
  the demo.
- Track classification (`threat_class`) comes from the fusion engine
  (Sprint 6). For Sprint-5-extension, `POST /v1/threats/score` accepts the
  class as input so the BMS workflow is demonstrable before fusion ships.
