# `will.dea.event.v0` — Delegated Engagement Authority audit-event contract

**Status:** DRAFT SKETCH — companion to `will.envelope.v0`, for ADR-019 co-sign discussion only. No implementation, no emitter, no consumer.

**What this contract is.** The wire shape of every audit record `will-doctrine` (future service) will emit as an envelope moves through its lifecycle. Every commitment, every candidate evaluation (allowed or dropped), every authorisation pushed to a vendor FCS, every engagement acknowledgement received back, and every abort at any tier is one record of this shape. The records form a tamper-evident hash chain per tenant — the ledger the post-action review will reconstruct events from.

**What this contract is not.**

- Not an engagement command. Events are *records of what happened*, not instructions.
- Not the envelope itself. Envelopes are `will.envelope.v0`; events reference them by id and by a snapshot hash.
- Not the vendor-facing authorisation wire format — that is per-vendor and lives in the `authorisation-gateway-<vendor>` contracts (not yet drafted).

## Source of truth

- **`event.schema.json`** — JSON Schema (Draft 2020-12). The machine-checkable definition.
- **`examples/valid/`** — one representative event per kind.
- **`examples/invalid/`** — cases the emitter must never produce; each with a `.reason.md`.

If English text in this README and the JSON Schema disagree, the JSON Schema is authoritative.

## Event kinds

Ten kinds, discriminated by `event_type`. Each has a specific `payload` shape.

| `event_type` | When emitted | Who triggers it |
|---|---|---|
| `envelope.committed` | A commander's signed envelope is admitted. | Committing commander. |
| `envelope.revoked` | An identity on `abort_authority` calls revoke. | Named aborter. |
| `envelope.expired` | Envelope's `time_window.not_after` passes. | System clock. |
| `candidate.allowed` | A track passes every envelope check and becomes eligible for authorisation. | Rules engine. |
| `candidate.dropped` | A track is evaluated and fails one or more checks. | Rules engine. |
| `authorisation.pushed` | An authorisation is dispatched to a vendor-FCS gateway. | Doctrine service. |
| `engagement.ack` | The vendor FCS reports back what it actually did. | Vendor FCS via gateway. |
| `abort.family_halt` | A family-wide halt is triggered for one effector family. | Named aborter. |
| `abort.tenant_all` | Tenant-wide `abort_all` is triggered. | Duty officer role. |
| `magazine.updated` | Rounds consumed against an envelope's magazine cap. | Vendor FCS via gateway. |

`candidate.dropped` is deliberately as auditable as `candidate.allowed` — dropping a track is a decision worth recording.

## Field-by-field walkthrough

### Common to every event

| Field | Meaning | Legal / Compliance note |
|---|---|---|
| `schema` | Literal `"will.dea.event.v0"`. Refuse unknown values. | Version handshake. |
| `event_id` | UUIDv7 (monotonic + random). | Every downstream reference names this id. |
| `event_type` | One of the ten kinds above. | Discriminator for `payload`. |
| `occurred_at` | RFC 3339 UTC timestamp of the event. Consumer refuses events with `occurred_at` more than `+30s` in the future (clock-skew guard). | The time this event actually took place, not the time it was written. |
| `tenant_id` | ADR-006 tenant. | Every ledger chain is tenant-scoped. |
| `envelope_id` | Reference to the envelope this event pertains to. Required except for `abort.tenant_all` (which affects all envelopes in the tenant). | Ties the event to a signed envelope's provenance. |
| `envelope_snapshot_hash` | SHA-256 of the canonical envelope at commitment time. Every event on a given envelope carries the same hash. | Bind the audit record to the exact envelope shape as it was signed, even if the envelope is later replaced by a new version with the same id (which is refused, but this defends anyway). |
| `classification` | STANAG-4774 marking. Inherited from the envelope; explicit on the event for tamper-evidence. | An event's classification cannot exceed its envelope's classification. |
| `source_service` | `{name, version, instance_id}` of the emitter (e.g. `will-doctrine` `0.3.0` `pod-abc`). | Provenance of the audit record itself. |
| `ledger_prev_hash` | SHA-256 of the previous event's canonical serialisation in this tenant's ledger, OR the well-known genesis constant `"0000…"` for the first event. | Tamper-evident chain. Rewriting history requires re-signing every subsequent event. |
| `signature` | Signature block over the canonical serialisation of every other field, by the `source_service`'s signing key. | Bound to the doctrine service's key custody (ADR-007 successor). Distinct from the *envelope's* signature (which is the commander's). |
| `payload` | Kind-specific object; shape depends on `event_type`. | See per-kind sections below. |

### `envelope.committed`

```json
{
  "committer_ref": { "npki_dn": "…", "identity_hash": "…" },
  "envelope_signature_algorithm": "Ed25519",
  "envelope_signature_key_ref": "vault://npki/…"
}
```

The envelope's own signature block is recorded on the event so the audit can prove which commander signed. The envelope itself is retrievable by `envelope_id`; storing its hash on every event (and its signature metadata on the commit event) means a corrupted envelope store can be detected.

### `envelope.revoked`

```json
{
  "revoker_ref": { "npki_dn": "…", "identity_hash": "…" },
  "reason_code": "ROU-REV-INTENT-CHANGED",
  "reason_note": "Sector change — friendly ISR relocated into box."
}
```

`reason_code` is from a controlled vocabulary; `reason_note` is free-text for post-action review.

### `envelope.expired`

No payload beyond the common fields — the timestamp is the record. `envelope_id` and `envelope_snapshot_hash` say which envelope.

### `candidate.allowed`

```json
{
  "track_id": "skynex-sim-01",
  "track_snapshot_hash": "…",
  "fusion_confidence": 0.87,
  "app6d_sidc": "SHAPMFL----------",
  "effector_family_selected": "skynex/battery-1/*"
}
```

`track_snapshot_hash` is a SHA-256 of the canonical `will.track.v0` record at evaluation time, so the audit can later ask: "which track, exactly, did the rules engine allow?"

### `candidate.dropped`

```json
{
  "track_id": "skynex-sim-01",
  "track_snapshot_hash": "…",
  "drop_reason": "OUT_OF_SECTOR",
  "drop_reason_detail": "Track lat=45.95 lon=24.81 outside envelope sector."
}
```

`drop_reason` enum:
- `OUT_OF_SECTOR`
- `OUT_OF_TIME_WINDOW`
- `TARGET_CLASS_NOT_ALLOWED`
- `CLASSIFICATION_ABOVE_CEILING`
- `WEAPONS_STATE_NOT_FREE`
- `FUSION_CONFIDENCE_BELOW_FLOOR`
- `MAGAZINE_EXHAUSTED`
- `ENVELOPE_INACTIVE`
- `EFFECTOR_UNAVAILABLE`
- `ABORT_ACTIVE`
- `OTHER`

`OTHER` requires `drop_reason_detail`.

### `authorisation.pushed`

```json
{
  "correlation_id": "auth-01895a30-…",
  "track_id": "skynex-sim-01",
  "effector_family": "skynex/battery-1/*",
  "gateway_ref": "authorisation-gateway-skynex/pod-xyz"
}
```

`correlation_id` is the join key with the `engagement.ack` that follows.

### `engagement.ack`

```json
{
  "correlation_id": "auth-01895a30-…",
  "effector_id": "skynex/battery-1/gun-3",
  "outcome": "TARGET_NEUTRALISED",
  "rounds_consumed": 24,
  "vendor_ack_at": "2026-07-14T14:07:12.410Z"
}
```

`outcome` enum:
- `TARGET_NEUTRALISED`
- `TARGET_HIT_UNCONFIRMED`
- `TARGET_LOST`
- `MISS`
- `ENGAGEMENT_ABORTED`
- `VENDOR_DECLINED`
- `TIMEOUT_NO_ACK`

`vendor_ack_at` is the vendor's own timestamp of the outcome; the event's `occurred_at` is when the ack was received and recorded. Both are kept because they can differ.

### `abort.family_halt`

```json
{
  "aborter_ref": { "npki_dn": "…", "identity_hash": "…" },
  "effector_family": "skyranger/*",
  "affected_envelope_ids": ["…", "…"],
  "reason_code": "ROU-ABORT-FAMILY-COMMS-LOSS",
  "reason_note": "Skyranger gateway lost mTLS — halting to prevent stale authorisations."
}
```

### `abort.tenant_all`

The **only** event that does not carry an `envelope_id` (its `envelope_id` field is explicitly `null`), because it affects every envelope in the tenant.

```json
{
  "aborter_ref": { "npki_dn": "…", "identity_hash": "…" },
  "aborter_role_authority": "RO_MOD.DUTY_OFFICER",
  "affected_envelope_ids": ["…", "…", "…"],
  "reason_code": "ROU-ABORT-TENANT-DIRECTED",
  "reason_note": "Command post directive — cease all delegated engagement pending briefing."
}
```

`affected_envelope_ids` lists every envelope active at the moment of abort; the list is a snapshot, not an incremental stream.

### `magazine.updated`

```json
{
  "effector_id": "skynex/battery-1/gun-3",
  "rounds_delta": -24,
  "rounds_remaining_authorised": 456,
  "magazine_cap_source_envelope_id": "…"
}
```

The delta is always negative (consumption); positive deltas (reloads) are outside DEA scope — they are inventory events, not engagement authority events.

## Ledger integrity

The `ledger_prev_hash` field turns the event stream into a hash chain per tenant. Rewriting any past event invalidates every subsequent event's signature and chain link. The chain does not replace the STANAG-4778 crypto binding — it complements it. Compromise of the signing key requires re-signing every event to remain undetected, and detection is automatic on any consumer that re-verifies the chain.

Consumer-side check: `TestLedgerChainIntact` — walk the tenant's event stream in `occurred_at` order and confirm every event's `ledger_prev_hash` matches the previous event's canonical-form hash. Break = incident.

## The invariants (shape-level)

Recorded here for the eventual `TestDEAEventInvariants` guard. Each has a corresponding `examples/invalid/` case.

1. **Every event has a signature.** No unsigned events on the ledger.
2. **`envelope_id` present iff `event_type != "abort.tenant_all"`.** Every other kind names its envelope.
3. **`ledger_prev_hash` present on every event.** First event in a tenant's ledger uses the genesis constant, not `null`.
4. **`candidate.dropped` has `drop_reason`.** An unexplained drop is uninterpretable audit.
5. **`abort.tenant_all` has at least one `affected_envelope_ids` entry.** An aborter action that affected nothing is either a bug or a probe; refuse.
6. **Event classification ≤ envelope classification.** Same fail-closed comparison as ADR-017.
7. **`occurred_at` not more than 30 s in the future.** Clock-skew guard against forward-dated events.

Invariants not encoded in this shape but enforced at consumer-side code:

- Every `authorisation.pushed` is followed within N seconds by exactly one `engagement.ack` with the matching `correlation_id`, OR a `TIMEOUT_NO_ACK` ack synthesised by the doctrine service.
- No `candidate.allowed` on an envelope whose most recent event was `envelope.revoked` or `envelope.expired`.
- No `envelope.committed` for an `envelope_id` that already has one.

## What's next after co-sign

- `will-doctrine` emitter (produces events, signs them, appends to the ledger).
- Consumer tooling: `TestLedgerChainIntact`, post-action-review UI, admissibility packaging for external audit.
- Retention policy: events are kept for at least the ORNISS-mandated period per classification (defined in the compliance file, not in this contract).

Nothing consumes this schema today. Introducing it commits WILL to nothing.
