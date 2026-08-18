# Invalid: self-referential abort violated

**Invariant:** `abort_authority` must contain `commander_ref` (matched by `npki_dn` + `identity_hash`).

**What the admission service must catch:** the committer (Cpt. Ionescu) is not listed in `abort_authority`. Only the CO (Col. Popescu) can revoke. If the CO is unreachable — over the horizon, comms-down, casualty — the envelope becomes a runaway commitment that its own author cannot stop.

**Why the invariant exists:** an envelope is a delegation of authority forward in time. The person delegating must retain the authority to revoke the delegation. A commander who cannot personally stop the machine they authorised has committed something they no longer control, which breaks Meaningful Human Control at the revocation edge, not the commitment edge.

**Not catchable by JSON Schema alone:** JSON Schema can require `abort_authority` to be a non-empty array of identity refs, but it cannot express "must contain the commander". This is a consumer-side admission check (`TestDEAInvariants` case 2).

**Correct fix:** add `commander_ref` back to `abort_authority` (the valid example `01-attritable-vector-swarm.json` shows the right shape — commander + CO both listed).
