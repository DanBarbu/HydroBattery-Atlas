# ADR-012 — Fires Coordination Measure awareness (READ-ONLY)

- Status: Accepted
- Date: (analysis option D)
- **Co-signed (mandatory, per analysis): Tech Lead · Compliance Officer · Security Engineer**
- Consulted: Product Owner, Squad Alpha (TDL), both Scrum Masters

## Context

The Romanian acquisition integration analysis flagged programme **#15**
(M142 HIMARS) as needing a *dedicated, bounded* module. HIMARS is
**offensive fires**. ADR-008 established that WILL is a cross-platform
**coordinator and decision-aid, never a fire-control system**. A naïve
"HIMARS effector" would drop offensive fires into the BMS pairing/COA
pipeline — categorically prohibited.

The only defensible scope is **awareness**: ingest Fire Support
Coordination Measures (FSCM) and fire-mission *status* from the
authoritative fires C2 (AFATDS-class) so the common operating picture can
**deconflict** — keep aircraft clear of an active ACA, warn that an NFA
overlaps a proposed action, show "rounds downrange" to the air picture.

## Decision

Add a `fires` service that is **strictly read-only with respect to fires**.

### What it does

1. Ingests FSCM **from the authoritative fires C2** (it receives measures
   that originate in AFATDS; it does not author them): NFA, RFA, FFA, CFL,
   FSCL, RFL, ACA, MFP — polygons/lines with effective time windows and,
   for ACA, an altitude band.
2. Ingests fire-mission **status** from the authoritative fires C2:
   `PLANNED · IN_PROGRESS · SHOT · SPLASH · COMPLETE · CANCELLED`, a target
   grid, an optional ACA reference, an ETA-splash, a firing-unit *label*.
3. Serves both as **deconfliction overlays / advisory checks** to the COP,
   the air picture, BFT, and (advisory, read-only) the BMS.

### What it must never do (enumerated prohibitions)

The following have **no endpoint, no code path, and no schema column**:

- create, plan, modify, or cancel a fire mission;
- task, cue, or command HIMARS or any firing unit;
- compute or store a firing/ballistic solution or technical fire-direction
  data;
- register HIMARS (or any fires platform) as a `will.effector.v1`
  effector, or expose it to BMS pairing / COA / engagement;
- send anything back to AFATDS or any fires C2 (the data flow is
  one-way: fires C2 → WILL).

AFATDS and the fires chain of command remain the sole authority for
everything in the prohibited list. The `deconfliction/check` endpoint is
**advisory only** — it returns flags, it never blocks, gates, or approves
anything.

## Alternatives considered

- *Model HIMARS as a BMS effector kind.* **Rejected outright** — it would
  place offensive fires inside the engagement coordinator. This is the
  exact line ADR-008 draws.
- *Two-way AFATDS integration.* Rejected — sending data toward the fires
  chain creates a tasking surface and an accreditation/liability class
  WILL will not own.
- *Do nothing (procurement-only).* Rejected — without FSCM awareness the
  air picture cannot deconflict against active ACAs, which is a real
  safety gap WILL can close on the awareness side without crossing the
  boundary.

## Consequences

- New `fires` service + `fires-sim` (AFATDS-style feed: an ACA over the
  Cincu corridor, an NFA over Cincu HQ, an FSCL; one HIMARS fire-mission
  status cycling PLANNED→…→COMPLETE with an ACA reference).
- New schema V0012 (`fscm`, `fire_mission_status`) with ADR-006-shape RLS.
  Note both POST routes are *ingest-from-authoritative-source*, not
  authoring; named accordingly.
- demo-ux gains a **Fires** view dominated by an "AWARENESS ONLY — NOT
  FIRE CONTROL" boundary banner, the active-FSCM list, the read-only
  fire-mission status board, and an advisory deconfliction check; a globe
  FSCM overlay layer (NFA red, RFA amber, ACA blue, FSCL line).
- BMS may *consult* FSCM read-only in a future change (advisory "this
  proposed engagement crosses an active ACA") — declared here, not built,
  and explicitly advisory if it ever is.
- Sprint-11 ORNISS pre-accreditation file references this ADR and its
  prohibition list as the documented control on the fires boundary.

## Status

Delivered. See `docs/fires/architecture.md`. Boundary verified by tests
that assert no authoring/tasking endpoint exists and that
`deconfliction/check` only returns advisory flags.
