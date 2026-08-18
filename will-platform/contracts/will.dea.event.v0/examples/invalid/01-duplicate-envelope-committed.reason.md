# Invalid: duplicate `envelope.committed` for the same envelope id

**Invariant (consumer-side):** exactly one `envelope.committed` event exists per `envelope_id` per tenant ledger.

**What the emitter must catch:** the ledger already contains an `envelope.committed` for `envelope_id = 01895a2e-8d3c-7c00-8fbb-2b9f2a2b1c40` (see `examples/valid/01-envelope-committed.json` — same envelope id, `occurred_at = 13:22:00.123Z`). This second event tries to re-commit it 15 seconds later. Refuse.

**Why the invariant exists:** the commitment event is the audit anchor for every subsequent event on the envelope (`envelope_snapshot_hash` is fixed at commit time; every event that follows references the same hash). A duplicate commitment would fork the audit — two "starting points" for the same envelope, ambiguous provenance for the tracks and authorisations that follow, and a legally-ambiguous MHC record ("which commit was the operative one?").

If a commander needs to change an envelope, the correct flow is:
1. Emit `envelope.revoked` for the current envelope.
2. Commit a **new** envelope with a **new** `envelope_id`.

**Not catchable by JSON Schema alone:** this event is well-formed in isolation. The check requires state — the emitter must maintain per-tenant an index of committed envelope ids and refuse a second `envelope.committed` for any id already in the index. This is the consumer-side `TestDEAEventInvariants` check "at most one committed event per envelope id."

**Symmetric case:** a `candidate.allowed` / `authorisation.pushed` / `magazine.updated` / `engagement.ack` on an `envelope_id` that has **never** had a `envelope.committed` — also refused, by the same state-index check.
