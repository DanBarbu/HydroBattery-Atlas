# ADR-018 — SAFE 2026 acquisitions: WILL integration strategy

- Status: Proposed
- Date: 2026-05-30 (SAFE contracts signed 21 May 2026)
- **Co-sign required before Accepted:** Tech Lead · Compliance Officer · Security Engineer · Product Owner · Programme Manager
- Consulted: both Scrum Masters, Backend (TDL), Edge Engineer, Fusion Engineer

## Context

On 21 May 2026 the Romanian MoD signed the first wave of EU **SAFE**-financed
contracts (€16.68B envelope approved by the European Commission). The wave
covers four programmes WILL must integrate, plus one US-supplied counter-UAS
asset in the same operational thread:

| # | Programme | Vendor | Quantity / value | Service |
|---|-----------|--------|-------------------|---------|
| 1 | **Lynx KF41** IFV | Rheinmetall Automecanica | 298 vehicles, €3.337B framework (Phase I 232 by 2030) | Land Forces |
| 2 | **MMPV-90** OPV / corvette | Rheinmetall (built locally) | 2 hulls (Bulgaria design) by 2030 | Navy / Black Sea |
| 3 | **Skynex** C-RAM/C-UAS | Rheinmetall | 7 systems, €476M | Air Defence |
| 4 | **Skyranger 35** mobile VSHORAD | Rheinmetall | 2 systems, €470M | Air Defence |
| 5 | **Vector** Class I Mini UAS + Scorpion | Quantum Systems | 34 + 15, €30.7M (delivery 2027) | Land ISR |
| — | **MEROPS** (auxiliary, adjacent thread) | US (low-cost C-UAS) | induction-stage | Air Defence (US-assisted) |

WILL's role across all of these is **coordinator and common operating picture**,
not the weapons platform. Each vendor's native C2 / fire-control remains
authoritative for engagement; WILL ingests tracks and status, fuses, displays,
and shares — same discipline as ADR-014 (BC2A bridge), ADR-016 (OSINT),
ADR-017 (TAK).

The platform already has the right shape for most of this — there are
precedents to extend, not green-field rewrites:

- `plugins/atak-mil` (CoT XML), `plugins/gmti` (STANAG 4607), `plugins/mavlink`,
  `plugins/adsb-osint`, `plugins/skynex-mock`, `plugins/sam-battery-mock`,
  `services/bms`, `services/bft`, `services/ownship`, `services/fires`,
  `services/legacy-c2`, `services/tak-gateway` (ADR-017 scaffold).
- Classification (STANAG-4774) wired end-to-end (ADR-005).
- TDL roadmap (Link-16 / Link-22 / VMF / CoT / MIP-4) owned by Squad Alpha
  (will-backend-tdl).

## Decision

For each programme: keep WILL **coordinator-only** (no kinetic-effector tasking
through WILL), integrate as a **plugin** unless a cross-tenant primitive
genuinely belongs in a core service, and gate any new external surface with the
existing classification + (where applicable) opt-out-decision discipline.

### Per-programme integration matrix

| Programme | Where it lives | Direction | Reuses | What's NEW | Out of scope |
|---|---|---|---|---|---|
| **Skynex C-UAS** | `plugins/skynex-cuas` (real) supersedes `skynex-mock` (kept as sim profile) | ingest-only | `forward.Track`, classification, threat tagging | adapter interface (sim + UDP/CoT-like real feed); APP-6D hostile-UAS encoding | issuing engagement orders to Skynex; weapons release |
| **Skyranger 35 VSHORAD** | `plugins/skyranger-vshorad` | ingest-only | same as Skynex | mobile-platform position + radar tracks + engagement *status* (advisory) | tasking the mount; weapons release |
| **Lynx KF41 IFV** | `plugins/lynx-ifv` + `services/bft` extension | bidirectional **status-only** (no fire-control) | `bft`, `atak-mil` (CoT), APP-6D | Rheinmetall vehicle telemetry adapter; crew tablet PLI feed; vehicle health summary | turret control, fire-control system access, ammunition release |
| **MMPV-90 corvette** | `services/ownship` extension + `plugins/mmpv90-naval` | ingest-only (Phase 1); bidirectional in Phase 2 once Link-22 ships | `ownship`, `gmti`, AIS layer | naval radar/EO/ESM tracks; ECDIS interop sketch; Phase-2 Link-22 dependency declared, not blocking | combat-management-system replacement; weapons direction |
| **Quantum Vector / Scorpion** | `plugins/vector-mini-uas` (extends `mavlink` pattern) | ingest-only | `mavlink`, MAVLink decoder | Quantum proprietary control-link adapter (stub until vendor SDK access); video advisory layer | flight tasking from WILL UI |
| **MEROPS** (auxiliary) | `plugins/merops-osint` on the **OSINT layer** (ADR-016) | ingest-only, advisory, low-confidence | `adsb-osint` advisory pattern | US Counter-UAS Marketplace feed adapter; `NESECRET // OSINT` marking | being treated as a trusted track source |

### Cross-cutting decisions

1. **No tasking, no weapons release through WILL.** This is the non-negotiable
   coordinator discipline (consistent with ADR-008/012/013/014/015/017). Every
   new plugin asserts this with a no-tasking conformance test.
2. **Classification posture.** Inbound tracks marked at the connection's
   configured ceiling (default `NESECRET`); the egress ceiling gate
   (`internal/egress`) already enforces fail-closed comparison. MEROPS marks
   `NESECRET // OSINT` per ADR-016. Cross-scheme NATO/RO comparison stays
   fail-closed until Compliance signs an equivalence table.
3. **EU AI Act posture.** Any ML model that touches threat scoring, target
   recommendation, or engagement prioritisation is **high-risk**. WILL keeps
   the human-in-the-loop coordinator role; no model is permitted to issue an
   effector instruction. The existing AI track-prediction model (`will-fusion`)
   is advisory-only and remains so. Conformance reviewed by will-compliance.
4. **EU Cyber Resilience Act + AQAP 2110.** Each new plugin enters the
   supply-chain attestation pipeline (SBOM, signed image, CVE budget) before
   merge to `main`. New SAFE plugins inherit the existing CI gates.
5. **ORNISS / Law 182/2002.** Per-programme accreditation appendices are owned
   by will-compliance; WILL ships the technical artefacts (architecture
   diagram, classification flow, audit trail extracts) but not the
   accreditation file itself.
6. **Wrap-don't-own.** WILL does not bundle, fork, or redistribute vendor
   stacks (Rheinmetall TacticalView, Quantum QBase, MEROPS server, etc.). Each
   integration is a network/file boundary the customer operates and accredits.
7. **TDL dependency declaration.** Only MMPV-90 Phase 2 truly depends on
   Link-22; the other four programmes can ship on the bus + CoT + MAVLink + the
   plugin's vendor protocol. Squad Alpha's TDL backlog is therefore NOT
   blocking for the first three SAFE plugins.
8. **Disabled-by-default where the new integration opens an external network
   surface.** The `tak-gateway` opt-out decision trigger pattern (ADR-017)
   applies to any plugin that initiates outbound connections to a vendor C2.
   `skynex-cuas` and `skyranger-vshorad` are ingest-only (vendor pushes to us),
   so the trigger isn't required there. `lynx-ifv` and `mmpv90-naval` will be
   evaluated case-by-case at scaffold time.

### Sprint slicing (handed to the Scrum Masters; not part of this ADR's normative content)

The order below reflects the priority confirmed by the platform owner
(Skynex/Skyranger first; the existing mock makes the integration path the
clearest):

1. `plugins/skynex-cuas` scaffold (this commit), real-feed adapter behind an
   interface, sim mode for dev.
2. `plugins/skyranger-vshorad` scaffold (same pattern, mobile platform PLI).
3. `plugins/vector-mini-uas` (extends `mavlink`; Quantum-specific adapter
   stub).
4. `plugins/lynx-ifv` + `services/bft` extension.
5. `services/ownship` extension + `plugins/mmpv90-naval` (Phase 1 ingest).
6. `plugins/merops-osint` on the OSINT layer.

## Alternatives considered

- *Build a single "SAFE adapter" mega-service.* Rejected — couples five
  unrelated vendor protocols, breaks per-plugin certification, fights the
  existing one-plugin-per-family convention.
- *Push everything into core (BMS, BFT, ownship) instead of plugins.* Rejected
  — vendor protocols change on vendor cadence; plugins are the boundary that
  isolates that churn from the certified core.
- *Wait for TDL gateways before integrating MMPV-90.* Rejected — Phase 1
  ingest-only (radar/EO/ESM/AIS) does not require Link-22; declaring the
  dependency and shipping Phase 1 unblocks the Navy without waiting for the
  TDL backlog.
- *Treat MEROPS as a trusted source.* Rejected — it is a US-supplied advisory
  feed; ADR-016's OSINT discipline is the right home (low-confidence,
  caveat-marked, excluded from auto-fusion).

## Consequences

- Six new plugin/service epics across Squads Alpha, Bravo, Charlie. Scrum
  Masters slice and prioritise.
- New conformance tests per plugin: no-tasking boundary, classification
  ceiling on any outbound surface, supply-chain attestation.
- `plugins/skynex-mock` is retained as a sim profile of `skynex-cuas`; not
  deleted (used by dev and HIL game-days).
- Programme Manager tracks ORNISS accreditation appendices per programme;
  Compliance Officer owns the EU AI Act conformance file.
- Architecture diagram and ADR index updated; backlog drops out of step 1 of
  the sprint slicing above.

## Status

**Proposed.** Implementation of `skynex-cuas` may begin in parallel with the
co-sign cycle because the plugin is ingest-only, the marking discipline is
already established, and the no-tasking boundary is a code-level invariant.
The other five programmes remain blocked at scaffold until this ADR is
Accepted.
