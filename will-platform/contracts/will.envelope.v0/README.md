# `will.envelope.v0` — Delegated Engagement Authority envelope contract

**Status:** DRAFT SKETCH — for ADR-019 co-sign discussion only. No implementation, no code path, no consumer exists yet. This directory is a schema artefact that Tech Lead, Legal counsel, Compliance Officer, Security Engineer, Product Owner, and Programme Manager can annotate together before ADR-019 is Accepted.

**What this contract is.** The wire shape of an engagement envelope — the authoritative record of a commander's *prior* commitment of the sector, target class, rules of engagement, time window, magazine cap, and abort authority under which vendor fire-control systems may engage autonomously at machine tempo. Every kinetic action WILL ever mediates must trace to exactly one envelope of this shape.

**What this contract is not.**

- Not a fire-control command. Envelopes describe *permission*, not *action*. The vendor FCS remains the effector.
- Not a per-shot record. Per-shot outcomes live in the `will.dea.event.v0` audit stream (out of scope for this document).
- Not an operational contract yet. Nothing in the platform consumes this schema. Accepting ADR-019 is a precondition for any consumer to exist.

## Source of truth

- **`envelope.schema.json`** — JSON Schema (Draft 2020-12). The machine-checkable definition.
- **`examples/valid/`** — envelopes that represent the operating patterns ADR-019 anticipates (attritable-side, manned C-UAS battery).
- **`examples/invalid/`** — envelopes that must be rejected at admission, one per shape-level invariant. Each carries a `.reason.md` explaining what the admission service must catch.

If English text in this README and the JSON Schema disagree, the JSON Schema is authoritative.

## Field-by-field walkthrough

### Identity and provenance

| Field | Meaning | Legal / Compliance note |
|---|---|---|
| `schema` | Literal `"will.envelope.v0"`. Refuse unknown values. | Version handshake — a future `v1` will not accept `v0` consumers silently. |
| `envelope_id` | UUIDv7 recommended (monotonic + random). Immutable once signed. | Every audit reference names this id. |
| `envelope_version` | Semver of *this envelope's* revision (starts `1.0.0`; increments if the same commander re-issues before commitment). | A signed envelope's `envelope_version` never changes; a re-issue is a new `envelope_id`. |
| `committed_at` | RFC 3339 UTC timestamp of commitment. | The MHC act's timestamp. |
| `tenant_id` | ADR-006 tenant UUID. | Envelopes are tenant-scoped; cross-tenant execution is forbidden. |

### The commander

| Field | Meaning | Legal / Compliance note |
|---|---|---|
| `commander_ref.npki_dn` | The committing officer's NPKI Distinguished Name. | This is the natural person whose Meaningful Human Control is on record. |
| `commander_ref.identity_hash` | Hash of the DN + issuer chain at commitment time. | Ties the audit record to the identity certificate as it stood then, even if the certificate is later rotated or revoked. |
| `commander_role_authority` | Role code from the RO MoD RBAC authority catalogue that authorises this envelope class. | The admission service verifies the commander's role at commitment time. A downgraded commander cannot recommit historical envelopes. |

### What is authorised — the scope

| Field | Meaning | Legal / Compliance note |
|---|---|---|
| `sector` | GeoJSON `Polygon` or `MultiPolygon` in WGS-84. Tracks outside are out-of-envelope. | Sector is exclusive of self and neutral territory unless the ROE code explicitly permits (documented outside this schema). |
| `target_class_allowlist` | Non-empty array of APP-6D SIDC glob patterns (e.g. `SHA*MFL*` for hostile air loitering munitions). A `?` matches one position; `*` matches remainder. **Patterns that would match a friendly (`SF*`) or neutral (`SN*`) affiliation are rejected.** | Prevents authoring an envelope that would authorise blue-on-blue. |
| `roe_code` | String identifier referencing an entry in the RO MoD ROE catalogue. Opaque to the schema; content-checked at admission. | ROE catalogue governance lives outside WILL. |
| `weapons_state` | Object mapping effector-class code → `HOLD` \| `TIGHT` \| `FREE`. Missing entries default to `HOLD`. | A `FREE` state must be explicit and per-class. |
| `effector_allowlist` | Non-empty array of effector-family patterns (e.g. `skynex/battery-1/*`, `vector/swarm-alpha/*`). **Wildcard `*` alone or `**` are rejected.** Every pattern must have at least one path segment before any wildcard. | Prevents an envelope that authorises every effector on the network. |
| `magazine_cap` | Object mapping effector-id (or effector-family pattern) → non-negative integer round/munition count. Zero means observation-only for that effector. | Bounds the maximum consumption the envelope can trigger. |
| `fusion_confidence_threshold` | Number in [0, 1]. Tracks whose fusion confidence is below this floor are ineligible. | Defense against under-confident sensor picks. |

### When it applies

| Field | Meaning | Legal / Compliance note |
|---|---|---|
| `time_window.not_before` | RFC 3339 UTC. Envelope inert before this instant. | |
| `time_window.not_after` | RFC 3339 UTC. Envelope expires at this instant. `not_after` must be strictly greater than `not_before`. | Envelopes without a finite expiry are refused. |
| `grace_ms` | Non-negative integer milliseconds. Delay before any authorisation is honoured after commitment, giving the commander a chance to abort. Default 0. | Optional; useful for high-stakes envelopes. |

### Who can stop it

| Field | Meaning | Legal / Compliance note |
|---|---|---|
| `abort_authority` | Non-empty array of identity refs (same shape as `commander_ref`). **Must contain the committing commander's identity.** The tenant duty officer role is implicitly always in this list even if not enumerated. | Prevents a commander from committing an envelope they cannot personally revoke. |

### Re-delegation

| Field | Meaning | Legal / Compliance note |
|---|---|---|
| `delegation_depth_cap` | Non-negative integer. `0` = this envelope may not be re-delegated. `n > 0` = re-delegation is permitted; the child envelope inherits `n-1`. Default `0`. | Explicit per-envelope opt-in for re-delegation. |
| `parent_envelope_id` | Present iff this envelope is a re-delegation. References the parent envelope. | Every re-delegated envelope must be tighter than or equal to its parent on every constraint (sector ⊆, time_window ⊆, target class ⊆, effector_allowlist ⊆, classification ≤, magazine_cap ≤). |

### AI in the loop

| Field | Meaning | Legal / Compliance note |
|---|---|---|
| `ai_models_in_loop` | Array of `{model_id, version, purpose, ai_act_conformity_ref}`. Every model whose output influences target-class matching, fusion confidence, effector selection, or magazine-cap decrements must be listed. Each entry references an ADR-020 registry entry; missing `ai_act_conformity_ref` for a `HIGH_RISK` model is rejected. | Makes the AI-Act conformity file per-envelope auditable. |

### Classification and signature

| Field | Meaning | Legal / Compliance note |
|---|---|---|
| `classification` | STANAG-4774 marking of the envelope itself. Every candidate track's marking must be ≤ this ceiling (same primitive as the ADR-017 egress gate; fail-closed on unrecognised markings). | An envelope classified `NESECRET` cannot cover a `SECRET` track even if all other constraints match. |
| `signature.algorithm` | `Ed25519` or `ECDSA-P256` initially. | Extensible; consumers refuse unknown algorithms. |
| `signature.key_ref` | KMS/Vault key id under which the commander signed. | Bound to the commander's NPKI identity at commitment time. |
| `signature.value` | Base64 signature over the canonical serialisation of every field above except the signature block itself. | Any post-commitment mutation invalidates the signature. |
| `signature.signed_over` | List of top-level field names included in the signed payload, in canonical order. | Consumers refuse signatures whose covered fields differ from the current field set (defence against silent schema drift). |

### Operator intent

| Field | Meaning | Legal / Compliance note |
|---|---|---|
| `notes` | Free-text, UTF-8, up to 4 KiB. The commander's own statement of intent in their own words. Audit-quality. | Post-action review depends on this being written well; the authoring UX should coach it. |

## The six shape-level invariants

Recorded here for the ADR-019 `TestDEAInvariants` guard. Each has a corresponding `examples/invalid/` case.

1. **No wildcard effector authorisation.** `effector_allowlist` may not contain `"*"` or `"**"`; every pattern must have at least one literal path segment before a wildcard.
2. **No self-referential abort.** `abort_authority` must contain `commander_ref` (matched by `npki_dn` + `identity_hash`).
3. **No re-delegation beyond declared depth.** A re-delegation whose parent has `delegation_depth_cap = 0` is rejected; a child whose depth would go below zero is rejected.
4. **No AI in the loop without registry conformity.** Every `ai_models_in_loop` entry classified `HIGH_RISK` must reference an ADR-020 conformity file; missing reference is rejected.
5. **No inverted time window.** `time_window.not_after` must be strictly greater than `time_window.not_before`, and both must be present.
6. **No friendly / neutral in `target_class_allowlist`.** Patterns whose second character resolves to `F` (friendly) or `N` (neutral) — including via wildcard expansion — are rejected at admission time.

Invariants that are **not** encoded in this envelope shape but are enforced at consumer-side code (documented for completeness):

- **No click-and-fire from a UI.** Enforced by the doctrine service refusing any engagement authorisation not backed by an active, valid envelope. Not a field on the envelope itself.
- **No effector task through a plugin.** Enforced by every plugin retaining its ADR-018 `TestNoTaskingSurface`.
- **No envelope activation while the tenant is under `abort_all`.** Enforced by the abort-tier state machine.

## What's next after co-sign

Once ADR-019 and ADR-020 are Accepted, the follow-on artefacts these three become the input to:

- `will.dea.event.v0` audit-record schema (draft in the same directory).
- `will-doctrine` service admission API (creates, revokes, exports envelopes; hosts the rules engine).
- Per-family `authorisation-gateway-<vendor>` service, first target attritable-side (Vector-derived).
- Commander-authoring UX in the tenant admin frontend and the operator picture.

None of those exists yet. This directory is the load-bearing artefact that lets Legal, Compliance, and the Tech Lead argue about the shape *before* code exists to defend.
