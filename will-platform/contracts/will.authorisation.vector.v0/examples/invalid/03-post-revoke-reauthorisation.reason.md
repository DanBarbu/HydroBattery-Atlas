# Invalid: post-`REVOKE` re-authorisation on the same envelope

**Invariant (consumer + vendor-side):** once a `REVOKE` has been issued for a `(envelope_id, swarm_id)` pair, no further `ISSUE` or `AMEND` on the same pair may be emitted or honoured. Re-authorisation requires a new envelope with a new `envelope_id`.

**What must catch this:** the referenced envelope `01895a2e-…` was revoked at `14:33:00Z` by the tenant-wide abort in `will.dea.event.v0/examples/valid/04-abort-tenant-all.json`, and the corresponding REVOKE authorisation was sent to `vector/swarm-alpha` at `14:33:00.200Z` (see `examples/valid/03-revoke.json`). This ISSUE, 75 seconds later, tries to re-authorise the same envelope for the same swarm.

Both the emitter (doctrine service) and the vendor FCS refuse — the emitter to prevent the message being sent, the vendor to defend against a compromised or replayed message that slipped past the emitter.

**Why the invariant exists:** REVOKE is the terminal state on the envelope's lifecycle. Permitting re-authorisation from a terminal state would let a bureaucratic action revive a commitment the commander (or an abort authority) explicitly ended, without capturing a fresh MHC record. Every re-authorisation must anchor in a fresh envelope with a fresh commander signature.

The tempting shortcut — "just re-issue on the same envelope after the abort clears" — is exactly the wrong pattern. The audit trail must show the commander (or their chain of command) *deciding again*, not the system *quietly resuming*.

**Not catchable by JSON Schema alone:** the authorisation is well-formed and its signature is fresh. Refusal requires the emitter and vendor FCS to track per-envelope lifecycle state (LIVE / REVOKED / EXPIRED / ABORTED) and refuse any authorisation that transitions out of a terminal state. This is the consumer-side `TestVectorAuthorisationInvariants` check "no post-REVOKE authorisation on the same envelope" (invariant 6 in the README), matched by the equivalent event-side invariant in `will.dea.event.v0/examples/invalid/02-candidate-allowed-after-revoke.reason.md`.

**Correct fix:** commander commits a **new** envelope (new `envelope_id`, new signature, new `envelope_snapshot_hash`). A fresh ISSUE deriving from the new envelope carries the fresh MHC anchor the situation requires.
