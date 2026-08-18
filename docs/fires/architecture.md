# Fires Coordination Module — Architecture

ADR-012. Covers Romanian acquisition #15 (M142 HIMARS). **READ-ONLY
awareness — NOT fire control.**

## The boundary (read this first)

WILL is a coordinator and decision-aid (ADR-008). HIMARS is offensive
fires. This module exists only so the common operating picture can
**deconflict** against active coordination measures and know that rounds
are downrange. It is one-way: the authoritative fires C2 (AFATDS-class)
**sends** awareness data **to** WILL.

### Prohibited — no endpoint, no code path, no schema column

- create / plan / modify / cancel a fire mission
- task / cue / command HIMARS or any firing unit
- compute or store a firing or ballistic solution
- register HIMARS (or any fires platform) as a `will.effector.v1`
  effector or expose it to BMS pairing / COA / engagement
- send anything back toward the fires C2

The `api_test.go::TestNoFireMissionAuthoringRoute` asserts the prohibited
routes do not exist; `deconfliction/check` returns `advisory_only: true`
and only ever returns flags.

## What it ingests (from the authoritative fires C2)

| Resource | Content |
|---|---|
| FSCM | NFA, RFA, FFA, CFL, FSCL, RFL, ACA, MFP — polygon/line, effective window, ACA altitude band |
| Fire-mission STATUS | `PLANNED · IN_PROGRESS · SHOT · SPLASH · COMPLETE · CANCELLED`, target grid (display/deconfliction only), ACA reference, ETA-splash, firing-unit *label*, observed-at |

## HTTP surface

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/healthz` | – | declares `mode: read-only-awareness` |
| GET | `/v1/fscm` | operator | all measures |
| POST | `/v1/fscm/ingest` | operator | ingest a measure *from* the fires C2 |
| GET | `/v1/fscm/active?at=` | operator | measures effective at a time |
| GET | `/v1/fire-missions` | operator | STATUS list |
| POST | `/v1/fire-missions/ingest-status` | operator | ingest STATUS *from* the fires C2 |
| GET | `/v1/deconfliction/check?lon=&lat=&alt=&at=` | operator | **advisory** flags only |

The two POSTs are *ingest-from-authoritative-source*, named so no reader
mistakes them for authoring. No `admin` route exists — there is nothing to
configure, because there is nothing to task.

## Deconfliction (advisory)

`internal/deconflict` runs point-in-polygon + effective-time + ACA
altitude-band tests and returns severity `info` or `caution` — never
anything stronger, because the module has no authority. Degenerate rings
never raise a flag (a malformed measure cannot produce a false caution).

A future, explicitly-advisory BMS hook ("this proposed engagement crosses
an active ACA") is declared in ADR-012 and not built here.

## Demo (fires-sim)

An AFATDS-style feed near the Cincu range:

- **NFA Cincu HQ** and **FSCL EAST** — always active.
- **ACA Cincu Corridor** (300–3000 m) — active only while the HIMARS
  fire-mission status is `IN_PROGRESS`/`SHOT`.
- One `FM-HIMARS-001` status cycling
  `PLANNED → IN_PROGRESS → SHOT → SPLASH → COMPLETE`, referencing the ACA.

demo-ux **Fires** view: a permanent red "AWARENESS ONLY — NOT FIRE
CONTROL" banner, the FSCM list (active/inactive), the read-only
fire-mission status board, and an advisory deconfliction check box. The
globe **Fires coordination** layer draws active measures (NFA red, RFA
amber, ACA blue, FSCL purple line).
