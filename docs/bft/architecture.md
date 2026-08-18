# Blue / Friendly Force Tracking — Architecture

> ADR-010. Closes the biggest gap from the Romanian acquisition
> integration analysis: Lynx KF41, M1A2 Abrams, Cobra II, Piranha III/V,
> and the friendly air picture.

## Where BFT sits

```
friendly position sources                BFT service
(BFT radios, ATAK, NFFI gateways,   ┌───────────────────────┐
 PPLI via Link-16 — roadmap)        │  POST /report         │
        │                           │   ├ normalize (minimal│
        │  CoT-friendly / NFFI /    │   │  profile, defensive│
        └──── will-native ─────────▶│   │  XXE-safe)         │
                                    │   └ store (per-tenant) │
                                    │  GET /friendly-assets  │
                                    │  GET /…/stale          │
                                    └───────────┬───────────┘
                                                ▼
                                    Forces view + globe layer
```

BFT is a **separate concern** from the threat picture (sensors → fusion →
BMS) and the effector picture. There is intentionally **no edge** in this
graph from a friendly asset to a threat or an engagement.

## Why a separate store

Mixing friendly assets into the threat/track store would create a
targeting surface (a bug could pair an engagement against a friendly).
Physical separation removes the entire risk class. ADR-010 records this
as the deciding factor.

## Normalisation — the WILL minimal profile

`internal/normalize` accepts three formats today:

| Format | Notes |
|---|---|
| `will_native` | JSON; used by `bft-sim` and simple integrators |
| `cot_friendly` | CoT atom with affiliation char `f`; hostile/unknown rejected (422) |
| `nffi` | NATO Friendly Force Information, minimal SIP3; APP-6 SIDC pos-2 must be F/A |

Declared in the schema, deferred in code (next additive profiles, same
pattern as STANAG 4607 HRR):

| Format | Status |
|---|---|
| `vmf_k05_1` | VMF K05.1 position report — roadmap |
| `link16_ppli` | Link-16 PPLI via the Sprint 8 TDL gateway — roadmap |

Every parser: 64 KiB cap, XXE-safe XML decoding, coordinate-range checks,
safe enum defaulting, friendly-only enforcement.

## Status model

`OPERATIONAL · DEGRADED · MAINTENANCE · NO_COMMS · BINGO · WINCHESTER`.
`BINGO` (minimum-fuel RTB) and `WINCHESTER` (munitions expended) are air
states; `bft-sim` cycles an F-16 through `BINGO` to exercise the UI.
`NO_COMMS` is derived: `/v1/friendly-assets/stale?seconds=N` returns
assets whose last report is older than N seconds.

## Echelon roll-up

`team · squad · platoon · company · battalion · brigade`. The Forces view
groups by branch then echelon so a commander reads the picture the way the
order of battle is structured.

## Tenant isolation & classification

- RLS in the ADR-006 shape; `cross_tenant_auditor` is the only role that
  crosses tenants.
- Each asset carries a STANAG 4774 classification label (ADR-005).

## What BFT does NOT do

- It does not target, score, or pair friendly assets.
- It does not run a tracking filter (constant last-report position; the
  Sprint 6 fusion engine is for the threat side, not BFT).
- It does not command or task friendly assets — read-only situational
  awareness.

## Romanian order of battle in `bft-sim`

Lynx KF41 ×2 (VANATOR-21/22), M1A2 Abrams (TUNARI-07), Cobra II
(LUPUL-3), Piranha V (SCORPION-5), F-16 ×2 (SOIM-01/02, one cycling
BINGO), dismounted SOF team (CERCETAS-1) — the exact platforms the
acquisition analysis flagged as invisible today.
