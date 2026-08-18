# Invalid: `AMEND` that loosens constraints

**Invariant (consumer + vendor-side):** an `AMEND` may only tighten. Every field must be equal or tighter than the previous authorisation for the same `(envelope_id, swarm_id)` pair.

**What the vendor FCS (and the emitter, pre-emission) must catch:** compared to the valid AMEND in `examples/valid/02-amend-tightens.json`, this one:

| Field | Previous (valid AMEND) | This AMEND | Direction |
|---|---|---|---|
| `sector` | 20×20 km box centred on the AO | 40×30 km box (superset) | **loosened** |
| `target_class_allowlist` | `[SHAPMFL*]` | `[SHAPMFL*, SHAPMFQ*, SHAPMH*]` (superset + adds rotary) | **loosened** |
| `weapons_state.ew` | `HOLD` | `FREE` | **loosened** |
| `magazine_cap_swarm` | 40 | 80 | **loosened** |
| `time_window.not_after` | 13:50Z | 14:10Z (extended 20 min) | **loosened** |
| `fusion_confidence_threshold` | 0.85 | 0.70 (floor lowered) | **loosened** |

Every axis is looser. Refuse.

**Why the invariant exists:** the commander's MHC act is committing the *initial* envelope. A later AMEND does not carry a new MHC signature — it is an operational adjustment, not a new commitment. Permitting a loosening AMEND would let a bureaucratic action expand the commander's original commitment without capturing a fresh MHC record.

The correct flow for a loosening change is:

1. `envelope.revoked` on the current envelope (audited MHC act by an abort authority).
2. Commander commits a **new** envelope with wider constraints and a fresh signature (audited MHC act).
3. New `ISSUE` authorisation derives from the new envelope.

This preserves accountability: every widening of engagement authority is anchored in a fresh, named human decision.

**Not catchable by JSON Schema alone:** each of the changed fields is shape-valid in isolation (the target class allowlist entries have the right prefixes, the magazine cap is a positive integer, the time window has `not_after > not_before`, etc.). The refusal requires the emitter and the vendor FCS to remember the previous authorisation for the same `(envelope_id, swarm_id)` and diff every constraint. This is the consumer-side `TestVectorAuthorisationInvariants` check "AMEND only tightens" (invariant 3 in the README).

**Symmetric case:** an AMEND on a `swarm_id` that has never received an `ISSUE` — also refused, because there is no baseline to tighten against.
