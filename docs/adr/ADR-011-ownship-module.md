# ADR-011 — Naval / Own-Ship integration as a mobile node

- Status: Accepted
- Date: (analysis option C)
- Deciders: Tech Lead, Compliance Officer, Security Engineer (co-signed, per analysis)
- Consulted: Squad Bravo (edge), Squad Charlie (UX), Product Owner

## Context

The Romanian acquisition integration analysis (`docs/bms/romanian-acquisition-integration-analysis.md`)
flagged programme **#3** (MMPV 90 corvette via Rheinmetall/NVL at Mangalia;
Hisar-class OPV via ASFAT) and **#1** (Rafael SEA-COM communications suite)
as needing a *dedicated module* — WILL had no concept of a vessel.

A vessel is not a fixed site like a Patriot battery. It is a **mobile node**
that:

- reports its own kinematics + posture (own-ship state, EMCON);
- carries a communications suite whose link health matters operationally
  (Rafael SEA-COM: VoIP / RoIP / HF / V-UHF / SATCOM);
- carries mounted sensors and effectors that **move with the hull**.

## Decision

Add an `ownship` service plus an `ownship-sim` source. A platform is a
first-class mobile node with three sub-resources: kinematic/EMCON **state**,
**comms** links, and mounted **payloads**.

Boundary, co-signed by Compliance + Security:

1. **WILL integrates the vessel; it does not run the vessel's fight.** The
   ship's own combat-management system (ADVENT / SitaWare-class) remains
   authoritative for the vessel's own engagements, weapon release, and
   sensor tasking. `ownship` neither tasks payloads nor runs engagements.
   This mirrors the ADR-008 BMS coordinator boundary.
2. **Own-ship effectors register into BMS with the platform id.** Pairing
   therefore knows the effector moves with the hull (range/altitude
   envelopes are relative to the ship's reported position). This keeps the
   BMS coordinator model intact without a special case.
3. **Comms-link health is first-class.** A vessel in EMCON SILENT (SATCOM
   DOWN, HF DEGRADED) is precisely the Sprint-5 offline-first / disconnected
   edge scenario; `ownship` exposes `/v1/platforms/comms-degraded` so the
   operator picture and the edge-sync behaviour stay consistent.
4. **RBAC + RLS as elsewhere.** State + comms are operator-trust telemetry
   (operator role). Payload declaration is `admin` (it changes what the
   federated BMS will pair against). Tenant isolation follows the ADR-006
   RLS shape; service-bypass for the service binary.

## Alternatives considered

- *Model a vessel as a Sprint-5 edge node only.* Rejected: the edge runtime
  is infrastructure (K3s, outbox, sync); it does not capture EMCON posture,
  the SEA-COM suite, or hull-mounted payload registration. The two compose
  cleanly — a deployed corvette runs the edge agent **and** reports
  own-ship state — but they are different concerns.
- *Reuse BFT (friendly assets) for ships.* Rejected: BFT is deliberately
  targeting-free situational awareness with no payloads and no comms model;
  a vessel needs payload registration into BMS, which BFT must never have.
- *Build a naval combat-management system.* Explicitly rejected. That is the
  vessel CMS's job and a different accreditation/liability class. WILL is a
  cross-platform coordinator (ADR-008); this ADR preserves that.

## Consequences

- New `ownship` service + `ownship-sim` (Romanian Black Sea picture off
  Constanța: MMPV 90 corvette cycling EMCON SILENT, Hisar OPV nominal).
- New schema V0011 (`platforms`, `platform_comms`, `platform_payloads`)
  with RLS.
- demo-ux gains a **Naval** view (kinematics + EMCON, SEA-COM link bar,
  mounted payloads, comms-degraded banner) and a globe naval layer
  (vessel amber when any comms link is not UP).
- Procurement leverage: #3 is **SAFE-funded** (Rheinmetall/NVL, Mangalia);
  the analysis notes the Bill-of-Origin angle for the Sprint-12 plugin
  registry. The Scrum Masters' procurement classification matrix should
  tag the ownship plugins accordingly.
- Future work: hull-mounted effectors should auto-register into BMS via a
  small adapter (declared here, not yet wired) so a corvette's NSM appears
  in the COA recommender at the ship's live position.

## Status

Delivered. See `docs/ownship/architecture.md`.
