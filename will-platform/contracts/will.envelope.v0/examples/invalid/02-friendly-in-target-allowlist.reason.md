# Invalid: target-class allowlist could match friendly / neutral

**Invariant:** patterns in `target_class_allowlist` that resolve to friendly (`SF*`) or neutral (`SN*`) affiliation — including via wildcard expansion — are rejected at admission.

**What the admission service must catch:** the pattern `S?APMFQ*` uses `?` on the affiliation position (character 2 of the SIDC). At match time, `?` will accept `F` (friendly) and `N` (neutral) as well as `H` (hostile) and `U` (unknown). This envelope, if admitted, would authorise engagement of friendly fixed-wing UAS in the sector — including WILL's own Vector orbits.

**Why the invariant exists:** this is the single most consequential shape-level check in the envelope. Blue-on-blue is the failure mode that would end the platform. The check is on the *pattern shape*, not the runtime match — a pattern that *could* match a friendly/neutral affiliation is refused at commitment time, before any track exists.

**Not catchable by JSON Schema alone:** JSON Schema's `pattern` field validates the pattern's own syntax; it cannot reason about what a downstream glob library would match. This is a consumer-side admission check (`TestDEAInvariants` case 6).

**Correct fix:** narrow the affiliation to a specific character or a bounded set:
- `SHAPMFQ*` — hostile only ✓
- `S[HU]APMFQ*` — hostile or unknown (if the admission service supports character classes and the ROE authorises engagement of unknowns) ✓
- `S?APMFQ*` — friend / neutral / hostile / unknown ✗ (this envelope's bug)
