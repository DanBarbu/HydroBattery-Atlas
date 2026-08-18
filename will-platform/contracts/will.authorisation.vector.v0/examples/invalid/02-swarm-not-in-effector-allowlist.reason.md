# Invalid: `swarm_id` not in the envelope's `effector_allowlist`

**Invariant:** `swarm_id` must be matched by at least one pattern in the referenced envelope's `effector_allowlist`.

**What must catch this:** the referenced envelope (`01895a2e-…`, see `will.envelope.v0/examples/valid/01-attritable-vector-swarm.json`) has:

```json
"effector_allowlist": ["vector/swarm-alpha/*"]
```

This authorisation targets `vector/swarm-bravo`, which is not matched by any pattern in the envelope's allowlist. Refuse — the commander did not authorise `swarm-bravo`.

**Why the invariant exists:** the `effector_allowlist` on the envelope is the commander's explicit statement of which effectors the envelope may drive. Bypassing it, even by a well-formed authorisation with a valid signature, is a scope escalation the commander did not consent to. This is the machine-checkable back-end of the "no wildcard effector authorisation" invariant recorded on the envelope (see `will.envelope.v0/README.md` invariant 1) — the envelope refuses to be authored with a wildcard; the authorisation refuses to derive from an envelope for a swarm the envelope does not name.

**Not catchable by JSON Schema alone:** the authorisation shape is well-formed. Refusal requires the emitter (and, ideally, the vendor FCS) to fetch the referenced envelope by `envelope_id`, verify its `envelope_snapshot_hash`, and confirm the authorisation's `swarm_id` matches an allowlist pattern. This is the consumer-side `TestVectorAuthorisationInvariants` check "swarm_id matches an entry in envelope.effector_allowlist" (invariant 1 in the README).

**Correct fix:** either target `vector/swarm-alpha` (matched by the envelope's allowlist), or have the commander commit a new envelope whose allowlist includes `vector/swarm-bravo`. The two options preserve accountability at different points — pick the first for a same-envelope adjustment, the second when the operational need genuinely calls for a different swarm.
