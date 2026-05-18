# ADR-010 — Blue / Friendly Force Tracking (BFT) module

- **Status:** Accepted
- **Date:** Post-ADR-009
- **Decider:** Tech Lead, with Backend Core-1, Backend TDL, Product Owner
- **Consulted:** Compliance Officer, Security Engineer, both Scrum Masters

## Context

The Romanian acquisition integration analysis
(`docs/bms/romanian-acquisition-integration-analysis.md`) found that four
major land programmes — **Lynx KF41**, **M1A2 Abrams**, **Otokar Cobra II**,
**Piranha III/V** — plus the friendly air picture (F-16/F-35) have **no
first-class representation** in WILL today. They appear only if someone
runs ATAK on them. This is the single biggest coverage gap and the one with
the lowest delivery risk.

## Decision

Add a dedicated **BFT module** — a `bft` service plus a `bft-sim` reference
source — that maintains the friendly-force picture as a separate concern
from threats and effectors.

- **Schema** `V0009__bft.sql`: `friendly_assets` keyed on
  `(tenant_id, external_id)`; platform-type / branch / echelon / status
  enumerations; RLS in the ADR-006 shape.
- **Normalisation** (`internal/normalize`): a defensive *minimal profile*
  of CoT-friendly, NFFI (NATO Friendly Force Information), and a WILL-native
  JSON shape. Hostile inputs never crash; non-friendly inputs are rejected
  with a clear error (HTTP 422). VMF K05.1 and Link-16 PPLI are declared in
  the schema and documented as the next additive profiles — kept out of
  code until a real feed exists, exactly as STANAG 4607 HRR was deferred.
- **Service** (`bft`): `GET /v1/friendly-assets`, `…/stale?seconds=N`
  (NO_COMMS detection), `…/{id}`, and `POST /v1/friendly-assets/report`
  with a format hint header.
- **Operator UX**: a dedicated **Forces** view in demo-ux grouping assets
  by branch/echelon with status and stale (no-comms) detection, plus a
  toggleable friendly-force layer on the globe.

## Boundary (important)

BFT is **situational awareness only**. There is deliberately **no link
from a friendly asset to a threat or an engagement**. A friendly asset
cannot be targeted, scored, or paired. This keeps BFT entirely clear of
the ADR-008 coordinator boundary — there is no targeting surface to abuse.
The Compliance Officer confirmed this before acceptance.

Friendly classification labels (STANAG 4774, per ADR-005) ride on each
asset; cross-tenant visibility follows the ADR-006 RLS model
(`cross_tenant_auditor` only).

## Alternatives considered

- **Reuse the threat/track pipeline with a "friendly" flag.** Rejected.
  Mixing friendly assets into the threat store invites an accidental
  targeting linkage; physical separation of the store removes the risk
  class entirely.
- **Treat BFT purely as a CoT layer in the frontend.** Rejected. Doctrine
  needs NFFI ingest, NO_COMMS detection, and echelon roll-up — none of
  which belong in the browser.
- **Wait for the Sprint 6 fusion engine.** Rejected. Friendly-force
  tracking is not a fusion problem; it is an ingest + registry + roll-up
  problem and is independent of the threat-fusion work.

## Consequences

- New `bft` service in the deployment graph (ADR-004 Helm packaging).
- `bft-sim` ships a Romanian order of battle (Lynx ×2, Abrams, Cobra II,
  Piranha V, F-16 ×2, dismounted) so the gap the analysis identified is
  visibly closed in the demo.
- VMF / Link-16 PPLI ingest is a clean additive follow-up — new functions
  in `internal/normalize` plus a `source_format` enum value already
  reserved in the schema.
- Procurement leverage: Lynx KF41 and the corvette programme are
  SAFE-funded; BFT plugins must be tagged in the procurement
  classification matrix on day one (Scrum Masters own this).

## Verification

- `internal/normalize` unit tests cover CoT-friendly accept, hostile
  reject, NFFI friend/hostile, WILL-native happy path, XXE defence,
  oversize/empty guards, and safe enum defaulting.
- `internal/store` tests cover upsert-by-external-id, branch/callsign
  ordering, NO_COMMS staleness, and tenant isolation.
- `internal/api` tests cover ingest of each format, the 422 on a hostile
  CoT, the operator RBAC gate, and the stale endpoint.
- demo-ux exercises the operator experience end-to-end.
