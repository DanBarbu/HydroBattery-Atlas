# ADR-014 — Legacy C2 Bridge (BC2A® / ICIS interoperability)

- Status: Accepted
- Date: (post training module)
- **Co-signed: Tech Lead · Compliance Officer**; Consulted: Security Engineer, Backend TDL, both Scrum Masters

## Context

MApN's Land Forces C2 baseline is **BC2A®** (Battlespace Command & Control
Application, Interactive Software / ISW), running over **ICIS**, exchanging
data as NATO **JC3IEDM / MIP** blocks and **AdatP-3** formatted messages,
rendering **MIL-STD-2525D / APP-6(C/D)** symbology, optimised for
low-bandwidth tactical bearers (Harris/Thales HF/VHF). The 2022 SEAP
tender (~194 M RON) modernises this suite under FMN interoperability.

WILL must **interoperate with**, not replace, BC2A. The
publicly-documented upgrade roadmap is explicit: Phase 1 = ingest &
abstract (treat the legacy system as a sensor source via a Protocol
Adapter Layer), with a southbound path that renders the fused picture
back into MIL-STD-2525D so legacy operators stay operational.

## Decision

Add a `legacy-c2` service — a bidirectional Protocol Adapter Layer.

### Northbound (ingest — Phase 1)

- Parse a **WILL minimal profile** of **JC3IEDM** object/track records
  and **AdatP-3** track-report messages received from an ICIS / MIP
  replication gateway.
- Normalise to the canonical `will.track.v0` shape and publish like any
  other sensor source. **BC2A is treated as a sensor data source**, not
  the master database.

### Southbound (egress — backwards compatibility)

- Render WILL canonical tracks/alerts to **MIL-STD-2525D / APP-6(D)**
  SIDC plus an **AdatP-3** track-report string, exposed on a southbound
  feed for injection into BC2A client loops.

### The boundary (why this needs an ADR)

1. **WILL never writes to BC2A's database and never commands BC2A.** The
   southbound feed is *advisory / display backwards-compat* — it produces
   messages; the injection into BC2A loops is performed by the customer's
   ICIS gateway, not by WILL. There is no DB-write and no tasking route;
   `api_test.go::TestNoLegacyWriteOrCommandRoutes` asserts this.
2. **Provenance: public NATO standards only.** JC3IEDM, AdatP-3, APP-6,
   MIP are public. No proprietary BC2A / ISW code, schema, or trade
   secret was used. The minimal profiles are documented and defensive,
   exactly as the STANAG 4607 and NFFI decoders are.
3. **Classification is preserved end-to-end.** JC3IEDM security fields and
   AdatP-3 classification map to STANAG 4774 / RO national markings
   (ADR-005); the bridge never downgrades or strips a marking.
4. Tenant-scoped, RLS in the ADR-006 shape.

## Alternatives considered

- *Change BC2A's schema / become the master DB.* Rejected — the roadmap
  and every interop principle say wrap, don't rewrite; owning BC2A's DB
  is an accreditation and liability class WILL will not take.
- *Parse raw MIP binary replication on the wire.* Rejected for this
  module — the realistic, supportable integration point is a MIP/JC3IEDM
  replication gateway emitting structured records; the wire-level MIP
  block decoder is a future additive profile (declared, not built),
  mirroring how STANAG 4607 HRR was deferred.
- *Southbound writes directly into BC2A.* Rejected — see boundary #1.

## Consequences

- New `legacy-c2` service (`jc3iedm`, `adatp3`, `app6`, `store`, `api`)
  and a `bc2a-sim` plugin (ICIS-style replication near Cincu).
- New schema V0014 (`legacy_tracks`, `southbound_messages`) with
  ADR-006-shape RLS.
- demo-ux **Legacy C2** view: northbound ingest stream, the canonical
  tracks BC2A contributes to the COP, and the southbound 2525D + AdatP-3
  feed with the advisory/backwards-compat note.
- Wire-level MIP replication and full AdatP-3 message-catalogue support
  are clean additive follow-ups.
- Sprint-11 ORNISS file references this ADR for the legacy-interop and
  classification-preservation controls.

## Status

Delivered. See `docs/legacy-c2/architecture.md`.
