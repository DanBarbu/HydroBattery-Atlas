# Invalid: `candidate.allowed` on an envelope that was already revoked / expired / tenant-aborted

**Invariant (consumer-side):** no `candidate.allowed`, `authorisation.pushed`, `engagement.ack`, or `magazine.updated` event may be emitted for an envelope whose most recent lifecycle event is `envelope.revoked`, `envelope.expired`, or which is enumerated in a `abort.tenant_all` / `abort.family_halt` event that has not itself been superseded.

**What the emitter must catch:** envelope `01895a2e-8d3c-7c00-8fbb-2b9f2a2b1c40` was enumerated in `examples/valid/04-abort-tenant-all.json` at `14:33:00.000Z`. This event is a `candidate.allowed` on the same envelope 15.8 seconds later. Refuse — the envelope has been aborted; no track may be allowed against it.

The `envelope_snapshot_hash` still matches because the envelope's *content* is unchanged; only its *state* has moved to aborted. This is exactly the case a shape check cannot see and a lifecycle check must.

**Why the invariant exists:** abort is a load-bearing MHC primitive. If the audit stream can show an authorisation being emitted after an abort, either (a) the emitter has a bug, (b) the abort was not honoured, or (c) the ledger is being tampered with. All three are incidents and each must be visible to post-action review as a hard invariant violation, not a "yellow flag" heuristic.

**Not catchable by JSON Schema alone:** the offending event is well-formed and internally consistent. Detection requires the consumer (or emitter, pre-emission) to maintain per-envelope lifecycle state:
- `LIVE` — after `envelope.committed`, allows all downstream event kinds
- `REVOKED` / `EXPIRED` / `ABORTED` — only allows `envelope.expired` (if from LIVE by clock) or nothing further

Any transition attempt out of a terminal state is refused. This is the consumer-side `TestDEAEventInvariants` check "no downstream events on a terminated envelope."

**Related family:** the identical rule applies to `abort.family_halt` on an effector family — no `authorisation.pushed` on that effector family may follow the halt until the family is explicitly re-enabled (which is itself a separate authored event, not implicit).
