# `will.authorisation.vector.v0` — WILL → Vector/Scorpion swarm authorisation wire

**Status:** DRAFT SKETCH — completes the ADR-019 contract triangle (`will.envelope.v0` · `will.dea.event.v0` · this). Schema-only artefact for co-sign discussion. No emitter, no gateway, no consumer. **Attritable-only.** Manned-effector authorisation gateways (Skynex, Skyranger 35, MMPV-90 CIWS) require separate co-sign cycles with harder MHC files.

**What this contract is.** The outbound wire message the future `services/authorisation-gateway-vector` sends to a Quantum-derived Vector or Scorpion swarm ground station to communicate an envelope-scoped authorisation. Each message is either an `ISSUE` (grant new authorisation), an `AMEND` (tighten an existing one), or a `REVOKE` (cease). Nothing here commands the swarm to engage a specific target — the wire authorises the swarm's own onboard autonomy to engage tracks that match the envelope's constraints, within the envelope's time window, up to the envelope's magazine cap, on the swarm's own decision timeline.

**What this contract is not.**

- Not a fire command. There is no "shoot target X" field. The distinction is load-bearing for MHC/AI-Act.
- Not the vendor-side reverse channel. The vendor FCS's engagement acknowledgements come back through a separate wire (proto TBD when the vendor's actual protocol is available) and are what the doctrine service turns into `engagement.ack` records in `will.dea.event.v0`.
- Not manned-effector. Skynex/Skyranger/MMPV-90 authorisations will have their own schemas, likely with different proportionality fields and their own Legal review. Do not extend this schema to cover them.

## Attritable rationale

Choosing an attritable-first target for the first authorisation gateway is deliberate: attritable systems collapse two hard MHC arguments simultaneously.

- **Proportionality** — a small loitering munition or expendable UAS has a narrow lethal envelope; the proportionality reasoning per-round is far simpler than for a 35 mm AHEAD burst or a naval CIWS engagement.
- **Blast-radius on WILL compromise** — the swarm is expendable by design; a compromised authorisation cannot un-attritable an already-attritable system. The failure mode is loss of an attritable, not loss of a manned platform.

These do not make the co-sign trivial — they make it survivable. The manned-effector cases will inherit the wire shape and the invariant discipline defined here, but each will need its own MHC file and its own accreditation appendix. Explicit scope: **this contract binds Vector and Scorpion swarms only.**

## Source of truth

- **`authorisation.schema.json`** — JSON Schema Draft 2020-12, discriminated by `authorisation_type`.
- **`examples/valid/`** — one per authorisation type.
- **`examples/invalid/`** — cross-envelope invariants that the shape cannot catch alone.

## Authorisation types

| `authorisation_type` | When sent | Vendor FCS must |
|---|---|---|
| `ISSUE` | New authorisation for a freshly `envelope.committed` envelope (after any `grace_ms`). | Load the constraints; enter engagement-capable state within `ack_deadline_ms`; ACK receipt. |
| `AMEND` | Envelope constraints have been tightened (sector shrunk, target-class list reduced, weapons_state stepped down, magazine cap lowered, time window shortened, fusion threshold raised). **Loosening is forbidden — a loosening change requires a new envelope.** | Apply tighter constraints atomically within `ack_deadline_ms`; ACK. |
| `REVOKE` | Envelope revoked, expired, family-halted, or tenant-aborted. | Cease engagement decisioning within `abort_ack_deadline_ms`; ACK. Autonomy that already had a round in flight is expected to complete or terminate that round per its own safety design; further decisioning stops. |

## Field-by-field walkthrough

### Common to every authorisation

| Field | Meaning | Legal / Compliance note |
|---|---|---|
| `schema` | Literal `"will.authorisation.vector.v0"`. Refuse unknown. | Version handshake. |
| `authorisation_id` | UUIDv7. Immutable. | Every vendor ACK cites this id. |
| `authorisation_type` | `ISSUE` \| `AMEND` \| `REVOKE`. | Discriminator for `payload`. |
| `issued_at` | RFC 3339 UTC. | Vendor FCS uses this for freshness / replay detection alongside `ack_deadline_ms`. |
| `envelope_id` + `envelope_snapshot_hash` | References the envelope this authorisation derives from. | Every downstream ack ties back through this pair. |
| `tenant_id` | ADR-006 tenant. | Cross-tenant authorisation is forbidden. |
| `classification` | STANAG-4774; must equal the envelope's `classification`. | Tamper-evidence — vendor FCS refuses if the value doesn't match its cached envelope. |
| `swarm_id` | Effector-family scoped: e.g. `vector/swarm-alpha`. Must be contained by the envelope's `effector_allowlist`. | Vendor FCS refuses if it does not host `swarm_id`. |
| `correlation_id` | `auth-<uuid>-<swarm>-<seq>`. Present on ISSUE / AMEND (used by downstream engagement.ack); optional on REVOKE (revocation acks reference `authorisation_id` directly). | Join key with `engagement.ack` events in `will.dea.event.v0`. |
| `ack_deadline_ms` | Non-negative integer. Vendor FCS must ACK receipt within this window; timeout = doctrine service treats the authorisation as un-actioned and emits a follow-on. | Bounds silent failure. |
| `doctrine_service_signature` | Ed25519 / ECDSA-P256 signature over the canonical serialisation of every other field. Signed by the doctrine service's own key (ADR-007 successor). | Vendor FCS verifies this against WILL's published verification key before honouring the authorisation. |

### `ISSUE` payload

Distilled from the referenced envelope so the vendor FCS has everything it needs without accessing the envelope store:

| Field | Meaning |
|---|---|
| `sector` | Envelope's GeoJSON polygon/multipolygon, copied verbatim. |
| `target_class_allowlist` | APP-6D SIDC glob patterns copied verbatim. |
| `weapons_state` | Per-effector-class HOLD/TIGHT/FREE, copied verbatim. |
| `magazine_cap_swarm` | Integer total rounds/munitions the swarm may consume under this envelope. |
| `time_window` | `not_before`, `not_after`, copied verbatim. |
| `fusion_confidence_threshold` | Number in [0, 1], copied verbatim. |
| `grace_ms` | Optional non-negative integer; delay before this ISSUE is honoured (default 0). Copied from envelope. |
| `swarm_composition` | `{nodes_expected, per_node_magazine_estimate}` — advisory, so vendor FCS can sanity-check its swarm-side view against WILL's. |

### `AMEND` payload

Same fields as ISSUE, but with the invariant that each field's value MUST be equal-or-tighter than the previous authorisation for the same `envelope_id` + `swarm_id`:

- `sector` ⊆ previous sector (spatial containment)
- `target_class_allowlist` ⊆ previous
- `weapons_state` per effector class: `FREE` → `TIGHT` → `HOLD` monotonically down
- `magazine_cap_swarm` ≤ previous
- `time_window.not_after` ≤ previous `not_after` (may shorten but not extend)
- `fusion_confidence_threshold` ≥ previous (may raise the floor but not lower it)

**Loosening is forbidden**; a loosening change requires the commander to revoke the old envelope and commit a new one, so the MHC record captures the fresh act.

### `REVOKE` payload

| Field | Meaning |
|---|---|
| `abort_ack_deadline_ms` | Non-negative integer. Vendor FCS must ACK cessation within this window; failure is an incident. |
| `reason_code` | Controlled vocabulary: `ENVELOPE_REVOKED` / `ENVELOPE_EXPIRED` / `FAMILY_HALT` / `TENANT_ABORT`. |
| `reason_note` | Free-text, up to 4096 chars, audit-quality. |

## Cross-cutting

1. **REVOKE always wins.** If a REVOKE and an AMEND race in the vendor's inbox, REVOKE takes precedence regardless of order. Vendor FCS discipline required.
2. **Vendor cannot self-loosen.** Even if a later authorisation would be a shape-valid ISSUE for the same envelope, the vendor FCS refuses to loosen — it treats any post-REVOKE authorisation on the same `envelope_id` as an error and refuses. Re-authorisation requires a new envelope with a new `envelope_id`.
3. **Signature freshness.** `issued_at` older than N minutes (defined per deployment, typically 2 minutes) is refused as stale — replay defence. `ack_deadline_ms` provides forward freshness.
4. **No engagement command.** The schema deliberately has no `engage(track_id)` field. WILL never says "shoot X"; WILL says "you are authorised to autonomously engage things that match this envelope, until this time, up to this many rounds, at this confidence floor."
5. **Reverse channel is separate.** Vendor → WILL engagement acknowledgements are a different wire (per-vendor), consumed by the doctrine service and normalised into `will.dea.event.v0` `engagement.ack` events.

## The invariants (shape-level)

Recorded for the eventual `TestVectorAuthorisationInvariants` guard.

1. **`swarm_id` matches an entry in the envelope's `effector_allowlist`.** Cross-check requires envelope access; refused otherwise.
2. **`classification` equals the envelope's `classification`.** Not `≤`; must be exactly equal. Any drift is either bug or tampering.
3. **AMEND only tightens.** Every constraint compared against previous authorisation for the same `(envelope_id, swarm_id)`.
4. **`magazine_cap_swarm` never exceeds the envelope's per-effector cap for this `swarm_id`.**
5. **REVOKE cannot precede ISSUE for the same `(envelope_id, swarm_id)`.** Revoking what was never issued is a bug worth surfacing.
6. **Post-REVOKE authorisations on the same envelope are refused.** Vendor FCS discipline; also the doctrine service must not emit them.
7. **`doctrine_service_signature` verifies against the currently-trusted WILL verification key.** Vendor FCS discipline; signature drift = incident.

## What's next after co-sign

- Vendor reverse-channel schema — the shape of `engagement.ack` on the wire from Quantum's ground station back to WILL. Vendor-protocol-dependent; needs vendor SDK access.
- Second-family authorisation gateway (Skyranger 35 first, as it is the next-simplest attritable-adjacent case with its VSHORAD narrow autonomy).
- Manned-effector variants (Skynex, MMPV-90) — deferred until the attritable-side accreditation cycle completes and its lessons are folded back.

Nothing consumes this schema today.
