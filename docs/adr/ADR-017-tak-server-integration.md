# ADR-017 — TAK Server integration (bidirectional, classification-gated)

- Status: Proposed
- Date: (post OSINT module)
- **Co-sign required before Accepted: Tech Lead · Compliance Officer · Security Engineer**; Consulted: Product Owner, both Scrum Masters, Backend (TDL), Edge Engineer

## Context

The U.S. DoD TAK Product Center has open-sourced the civilian/core tiers
of the Team Awareness Kit:

- **ATAK-CIV** (`TAK-Product-Center/atak-civ`) — the Android client,
  ITAR-stripped of military-sensitive code.
- **TAK Server** (`TAK-Product-Center/Server`) — routes CoT, chat, and
  video between clients; open-sourced in 2022.

The restricted tiers (ATAK-MIL, ATAK-GOV) and their cryptographic /
tactical-data-link / warfare plug-ins remain government-only and are
**out of scope** — WILL never touches them.

WILL must manage sensor streams in real time, and a large share of the
Romanian/NATO tactical edge already runs TAK clients (ATAK/WinTAK/iTAK).
WILL already speaks the data language: a defensive Cursor-on-Target (CoT)
decoder (`plugins/atak-mil/internal/cot`) and an `atak-mil` plugin ingest
CoT over **UDP** and forward `will.track.v0` onto the bus. That is
one-way and mesh-only. Real TAK Server integration needs **TCP/TLS
streaming**, **TAK Protocol v1 (Protobuf)** in addition to CoT XML, and a
defined, classification-safe **egress** path so WILL tracks can appear on
the TAK common operating picture.

## Decision

Add a **`tak-gateway`** service that bridges WILL and a
**customer-operated** TAK Server, **bidirectionally**, with all egress
**classification-gated**.

WILL **wraps, does not own**. It does not bundle, redistribute, fork, or
host TAK Server or ATAK-CIV. The customer runs and accredits their TAK
Server; WILL connects to it. (Same discipline as the BC2A bridge,
ADR-014.)

### Direction & topology

- **Ingress (TAK → WILL):** the gateway connects to the customer TAK
  Server as a streaming client over **TCP/TLS with mutual-certificate
  auth** (TAK enrollment cert), negotiates **TAK Protocol v1** where
  offered (falling back to CoT XML), and normalizes inbound CoT events to
  `will.track.v0`. TAK is treated as a **sensor source** — same status as
  any other sensor; never authoritative over WILL's trusted picture
  without operator action.
- **Egress (WILL → TAK):** the gateway re-publishes a **filtered subset**
  of WILL tracks back to the TAK Server as CoT, so TAK clients see the
  WILL picture. Egress is **opt-in per tenant and per layer**, and is
  **classification-gated** (see below).
- **Topology:** Phase 1 connects as a TAK **streaming client**. Joining
  as a **Federation Hub federate** (gRPC/TLS peer) is the preferred
  enterprise topology and is declared here as a clean follow-up (ADR-017a)
  once the streaming bridge is proven.

### The boundary (why this needs an ADR)

- **Classification-gated egress (the central control).** Every track
  leaving WILL toward TAK passes a hard filter: its STANAG-4774 marking
  (ADR-005) must be **at or below** the accreditation ceiling configured
  for that TAK federation/connection. The default ceiling is `NESECRET`.
  A track above the ceiling is **dropped, never downgraded** — there is
  no re-marking on egress. OSINT tracks (`metadata.osint=true`, ADR-016)
  egress only if the tenant explicitly enables OSINT egress, and carry
  their `NESECRET // OSINT` marking. A conformance test
  (`egress_test.go::TestEgressNeverExceedsCeiling`) must assert no track
  above the ceiling is ever emitted, including for malformed/missing
  markings (fail-closed: unmarked ⇒ not emitted).
- **Wrap-don't-own.** No TAK Server / ATAK-CIV source is vendored into
  this repo. The gateway is a network client of an external, customer-run
  TAK Server. WILL's deliverable is the gateway only.
- **No restricted tiers.** ATAK-MIL/ATAK-GOV and their crypto/TDL plug-ins
  are never referenced, imported, or required. Interop uses only the
  public CoT schema (MITRE TR-04W0000345) and public TAK Protocol v1.
- **Coordinator discipline.** Ingesting and re-publishing situational
  awareness is in scope. **Tasking** TAK clients, sending orders, or
  driving any effector through TAK is **out of scope** — there is no
  command/tasking path in the gateway, asserted by a no-tasking test
  consistent with ADR-008/012/013/014/015.
- **Defensive parsing.** The TAK Protocol v1 protobuf + CoT XML decoders
  follow the existing minimal-profile discipline (size caps, bounded
  fields, hostile input never panics). Reuse and extend
  `plugins/atak-mil/internal/cot`.
- **mTLS + secrets.** Client enrollment certs and trust anchors come from
  the KMS/Vault path (ADR-007 successor); no certs or keys in config or
  the repo. TLS verification is mandatory (no insecure-skip option).
- **Tenant-scoped** (ADR-006). Connection config, egress toggles, and the
  accreditation ceiling are per tenant; RLS applies to stored config.

### Licensing & ITAR (Compliance gate — blocks "Accepted")

- ATAK-CIV and TAK Server are open-sourced but **not** under a standard
  OSI licence; they carry custom **TAK Product Center** terms. Compliance
  must review and record acceptance of those terms before any code lands,
  even though WILL only *interoperates* (does not redistribute).
- ATAK-CIV is explicitly **ITAR-stripped**, which is the only reason
  interop is clean; the gateway must rely solely on the public CoT/TAK
  Protocol surface and must not reintroduce any restricted capability.
- The CoT/TAK Protocol wire formats themselves are public and may be
  implemented independently; WILL's decoder is an independent
  implementation, not a copy of TAK Server code.

## Alternatives considered

- *Bundle/fork TAK Server inside WILL and run it ourselves.* Rejected —
  custom-licence redistribution, a second accreditation surface, and it
  breaks wrap-don't-own. The customer's TAK Server stays authoritative.
- *Keep the UDP-only `atak-mil` plugin and call it done.* Rejected — UDP
  mesh is one-way and does not reach a TAK Server's enterprise COP; no
  egress, no TLS, no TAK Protocol v1.
- *Bidirectional with no classification gate (mirror everything).*
  Rejected outright — uncontrolled egress of marked data to a TAK
  federation is a classification spill. The gate is the reason this is an
  ADR.
- *Ingest-only (no egress).* Considered and viable as a strict subset,
  but the chosen scope is bidirectional **because** egress is the high
  operational value (WILL picture on every TAK handheld) — gated to make
  it safe.

## Consequences

- New `tak-gateway` service: a TLS-streaming TAK client (CoT XML + TAK
  Protocol v1 protobuf), inbound CoT → `will.track.v0` normalizer, and a
  classification-gated egress publisher. Reuses/extends
  `plugins/atak-mil/internal/cot`.
- New per-tenant config in `tenant-admin`: TAK connection (host, mTLS
  cert ref), egress on/off per layer, and the accreditation **ceiling**.
- New conformance tests: `TestEgressNeverExceedsCeiling` (fail-closed),
  a no-tasking boundary test, and protobuf/XML fuzz-style decode tests.
- A `tak-sim` (or a containerized public TAK Server in the dev profile
  **only**, never shipped) to exercise the bridge in `docker-compose`.
- Federation Hub federate topology declared as ADR-017a follow-up.
- demo-ux: a TAK connection panel (status, ceiling, egress toggles) and a
  TAK layer on the globe distinct from native sensors.

## Status

**Proposed.** Implementation is blocked until Tech Lead, Compliance
(licence + ITAR), and Security (mTLS, egress gate) co-sign. No TAK code,
config, or vendored sources land before sign-off.
