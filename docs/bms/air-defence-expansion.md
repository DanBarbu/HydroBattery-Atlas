# Air-Defence Effector Expansion

> Analysis option **B** from `romanian-acquisition-integration-analysis.md`.
> Extends ADR-008 (no new ADR — same coordinator boundary, same Plugin SDK
> versioning). Covers acquisition programmes #2, #6, #8, #9, #10.

## What changed

| Programme | WILL change |
|---|---|
| #6 F-16/F-35 + AIM-120/AIM-9X | New `air_intercept` effector kind — a CAP fighter on station whose "rounds" are its AAM loadout |
| #10 Skynex / Oerlikon GDF-103 | New `gun_shorad` effector kind — 35 mm AHEAD close-in C-RAM / C-UAS gun |
| #8/#9 Patriot (2017–25, post-donation) | Refreshed envelope: PAC-3 MSE / Config 3+ — deeper range (100 km) and altitude (36 km), 16 rounds, **now ballistic-intercept compatible** |
| #2 NSM Coastal Defence | Refreshed envelope: ~185 km, sea-skimming, surface-only, low target speed (ship speeds) |

## Kind compatibility (refreshed)

| Effector kind | Engages |
|---|---|
| `sam_area` (Patriot) | **ballistic**, cruise, aircraft, uav_one_way, swarm |
| `sam_point` (C-RAM) | cruise, uav_one_way, swarm |
| `nsm_coastal` (NSM) | surface |
| `c_uas` | uav_one_way, swarm |
| `jammer_rf` | uav_one_way, swarm |
| `air_intercept` (CAP fighter) | cruise, aircraft, uav_one_way *(no BMD — fighters do not do ballistic-missile defence)* |
| `gun_shorad` (Skynex) | cruise, aircraft, uav_one_way, swarm |

Adding `ballistic` to `sam_area` closes a real gap: before this refresh a
ballistic threat could never be paired with any effector. Patriot PAC-3 MSE
is precisely the ballistic interceptor, so the refresh is doctrinally
correct, not a convenience.

## Public-domain envelope figures (illustrative)

All figures are approximate, drawn from public sources, and marked
illustrative in code. Integrators replace them with the customer's
classified performance data at deployment time — the model shape does not
change, only the numbers.

| Effector | min–max range | altitude band | max target speed | rounds |
|---|---|---|---|---|
| Patriot Bn 1 (PAC-3 MSE) | 3–100 km | 50 m – 36 km | 2 400 m/s | 16 |
| NSM Coastal Bty | 3–185 km | −10 m – 1 km | 40 m/s (ship) | 8 |
| Skynex Bty (GDF-103) | 100 m – 4 km | 0 – 3.5 km | 1 000 m/s | 1 200 |
| F-16 CAP SOIM-01 | 2–100 km | 30 m – 18 km | 900 m/s | 8 (AAM) |

## Reference plugins

- `plugins/skynex-mock` — `will.effector.v1` gun_shorad reference (Skymaster
  FC + 3D radar; AHEAD 35 mm).
- `plugins/cap-fighter-mock` — `will.effector.v1` air_intercept reference;
  a fighter that flies a CAP racetrack and reports `WINCHESTER` when its
  AAM loadout is expended.
- `plugins/sam-battery-mock` — re-tasked as the refreshed Patriot
  (PAC-3 MSE), 16 rounds.

## Coordinator boundary (unchanged, ADR-008)

The CAP fighter is modelled as an effector for **pairing and COA
prioritisation only**. The intercept geometry, the weapons-release
decision, and the aircrew authority remain entirely with the aircraft's
own fire-control and the chain of command. WILL proposes; an authorised
operator approves; the effector reports. No new fire-control surface is
introduced by adding the air-breathing or gun kinds.

## Demo

`bms` seeds now include the Skynex battery and the F-16 CAP; the demo-ux
mock adds a ballistic threat (`track-ballistic-1`) and a hostile aircraft
so the new pairings are immediately visible in the Battle Management view
and the COA recommendation panel: the ballistic is taken by Patriot, the
hostile aircraft by the CAP fighter, a close-in swarm by Skynex.
