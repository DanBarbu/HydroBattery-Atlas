# ADR-019 — Delegated Engagement Authority (DEA)

- Status: Proposed
- Date: (post ADR-018 SAFE plugin wave)
- **Co-sign required before Accepted:** Tech Lead · Compliance Officer · Security Engineer · Product Owner · Programme Manager · Legal counsel (RO MoD JAG or equivalent)
- Consulted: both Scrum Masters, Backend (TDL), Fusion Engineer, Edge Engineer

## Context

WILL is coordinator-only today (ADR-018). Every plugin asserts a
no-tasking boundary via `TestNoTaskingSurface`; no plugin holds an
outbound socket to any effector; every kinetic decision remains with the
vendor fire-control system. That discipline is the reason WILL can be
accredited and shipped now without carrying the full weight of EU
AI Act high-risk conformity, Meaningful Human Control (MHC)
adjudication, or IHL proportionality reasoning inside the platform.

Two operational realities are eroding that posture at the tempo edge:

1. **Swarm-tempo threats.** Ukraine and the Black Sea have already
   demonstrated that per-shot human-in-the-loop is not survivable against
   Shahed waves, FPV swarms, USV rushes, or coordinated multi-domain
   saturation. A commander watching a screen and clicking targets loses
   the engagement before the first round leaves. This is not a
   speculative future — it is the current operating environment for the
   SAFE-funded C-UAS batteries (Skynex, Skyranger 35) and for any
   maritime asset in the Black Sea AOR.

2. **Friendly attritable autonomy.** Squad Bravo's remit already names
   attritable autonomy and naval drone swarm research. A friendly swarm
   of 200 loitering munitions cannot be micro-managed by a human
   assigning targets one at a time; the swarm needs local autonomy
   inside a commander-committed envelope.

The industry answer converges on **human-on-the-loop with delegated
envelopes**: a commander commits, in advance, the sector, target class,
rules of engagement, time window, magazine cap, and abort authority; a
rules engine enforces the envelope in the loop; execution proceeds at
machine tempo within it; every action is audited; the commander can
revoke or abort at any moment. That model is compatible with EU AI Act
(high-risk, but the human commitment is the substantive decision),
IHL/MHC (envelope commitment IS the MHC act, per the ICRC / UN GGE
formulation of "sufficient human control"), and Romanian legal
accountability (a named commander signs the envelope; every shot is
traceable to that signature).

WILL cannot ignore this and remain relevant to the swarm-era battlespace
it is being funded to coordinate. It also cannot rush into it without
the doctrinal, technical, and legal scaffolding that keeps compromise
non-kinetic and human authority substantive.

## Decision

Add **Delegated Engagement Authority (DEA)** as a new WILL capability,
above the plugin layer, gated by a doctrinal + legal + technical
framework so that machine-tempo execution never means erosion of human
authority or accountability.

### The envelope is the unit of authorisation

A commander does not authorise individual shots. A commander authorises
an **engagement envelope**, encoded as `will.envelope.v0`:

| Field | Meaning |
|---|---|
| `envelope_id` | UUID; signed by the committing commander's key |
| `commander_ref` | NPKI identity of the committing commander |
| `commander_role_authority` | RBAC role authorised to commit this envelope class |
| `tenant_id` | ADR-006 tenant scope |
| `classification` | STANAG-4774 marking of the envelope itself |
| `sector` | GeoJSON polygon(s); an out-of-sector track is out-of-envelope |
| `target_class_allowlist` | APP-6D pattern set (e.g. `S*APMFL*` for hostile air loitering munitions) — nothing outside this list may be engaged under this envelope |
| `roe_code` | codified rules of engagement identifier (references the RO MoD ROE catalogue) |
| `weapons_state` | `HOLD` / `TIGHT` / `FREE` per allowed effector class |
| `effector_allowlist` | vendor-FCS families this envelope authorises (e.g. `skynex/*`, `skyranger/*/kinetic`) — never a wildcard `*` |
| `magazine_cap` | per-effector max rounds/munitions the envelope may consume |
| `time_window` | `not_before`, `not_after`; envelope inert outside this window |
| `abort_authority` | list of NPKI identities empowered to revoke this envelope (always includes commander and next-higher command; may include duty officers) |
| `delegation_depth_cap` | how many further delegation hops this envelope allows (default 0 — no re-delegation) |
| `notes` | free-text intent statement (audit-quality, for post-action review) |

### The rules engine enforces the envelope in the loop

The `will-doctrine` service (new) loads active envelopes and evaluates
every candidate engagement against the rules engine (Drools, already in
the Fusion Engineer stack). A track is **engagement-eligible under
envelope E** iff:

- E is active (within `time_window`, not revoked),
- track marking ≤ E's classification (ADR-005 comparison, fail-closed),
- track position ∈ E's sector,
- track APP-6D matches E's `target_class_allowlist`,
- E's `weapons_state` for the target's class is `FREE`,
- E's `magazine_cap` is not exhausted,
- fusion confidence ≥ threshold declared in E,
- no operator abort within the envelope's grace window.

Any single false → the candidate is dropped and logged. Every drop is as
auditable as every engagement.

### DEA does not replace the vendor FCS — it authorises it

DEA authorisations are pushed to vendor FCS via **per-family authorisation
gateways**, structurally analogous to `tak-gateway` (ADR-017) but
outbound: `authorisation-gateway-skynex`, `-skyranger`, `-vector`
(attritable-side), etc. Each gateway holds an `authorisation-actuable`
outbound socket to a single vendor FCS and speaks its native protocol.
Plugins under `plugins/*` remain coordinator-only; the authorisation
gateways under `services/authorisation-gateway-*` are the new,
scope-expanded surface.

Concretely: WILL does not command Skynex to fire on target T. WILL
commits envelope E; the Skynex Skymaster FCS, subscribing to E,
autonomously engages targets that match E's constraints within its own
narrow certified envelope. WILL is the delegation channel and the audit
ledger; the vendor FCS remains the effector.

### What stays permanently forbidden

Non-negotiable, encoded in code as `TestDEAInvariants`:

- **No click-and-fire.** Direct track → engagement command from any UI
  is never permitted, regardless of role. Every kinetic action must
  reference an active, valid envelope.
- **No blanket effector wildcards.** `effector_allowlist = "*"` is
  rejected at envelope-authoring time.
- **No self-referential envelope.** A commander cannot commit an
  envelope whose `abort_authority` list omits their own chain of
  command.
- **No re-delegation without explicit `delegation_depth_cap > 0`.** An
  envelope is single-level unless the committing commander explicitly
  authorises further delegation, and the depth-cap decrements on each
  hop.
- **No AI-model input to weapons-release inside the envelope loop
  without ADR-020 registry provenance.** Any model whose output can
  affect weapons_state or target_class matching must be a
  registry-served, signed, classification-labelled model per ADR-020.
- **No effector task through a plugin.** The `TestNoTaskingSurface`
  guard in every plugin (ADR-018) stays. Effector authorisation lives
  exclusively in `services/authorisation-gateway-*`.

### Abort is a first-class primitive

Three abort tiers, each independent of the others:

1. **Envelope revocation** — any `abort_authority` identity may revoke
   envelope E; all effector gateways stop honouring E within one bus
   round-trip.
2. **Effector-family halt** — halts all envelopes touching a family
   (e.g. all Skynex authorisations) without revoking envelopes covering
   other families.
3. **Tenant-wide DEA halt (`abort_all`)** — a duty officer role halts
   every DEA envelope for the tenant. Kill-switch semantics.

Abort actions are themselves signed, audited, and irreversible in the
audit ledger (an aborted envelope cannot be silently reactivated —
re-commitment requires a fresh envelope with fresh signature).

### Every action goes to a tamper-evident ledger

`will-doctrine` emits a `will.dea.event.v0` record for:

- envelope commitment, revocation, expiry;
- every candidate track evaluation (allowed or dropped, with reason);
- every authorisation pushed to a vendor FCS;
- every engagement acknowledgement received back from the vendor FCS;
- every abort at any tier.

Records are STANAG-4778 crypto-bound to the envelope's classification
label and stored in the existing tamper-evident audit subsystem
(`will-backend-core-2`).

## Cross-cutting

1. **EU AI Act posture.** DEA is high-risk. The conformity file lives
   with `will-compliance-officer` and is a prerequisite for the
   `services/authorisation-gateway-*` deployment. The envelope commit
   step is the substantive human decision; the rules engine and any
   models in-loop are the technical implementation and are conformity-
   assessed together with the envelope-authoring UX.
2. **Meaningful Human Control (IHL / ICRC / UN GGE on LAWS).** The
   envelope commitment is the MHC act. Envelope authoring UX
   (`will-frontend-tenant-ux` scope) must present the sector, target
   class, ROE, time window, magazine cap, and abort authorities in a
   form a commander can actually reason about — not a lawyer's schema
   dump. This is a design deliverable, not just a technical one.
3. **STANAG-4774 / 4778.** Envelope classification is compared
   fail-closed against every candidate track marking (same primitive as
   the ADR-017 egress gate). Audit records are 4778-bound.
4. **ADR-020 dependency.** Any AI in the DEA loop requires the sovereign
   model registry. ADR-020 is a prerequisite for the first DEA gateway
   to touch a vendor FCS.
5. **ORNISS accreditation.** DEA changes the accreditation surface. A
   dedicated accreditation appendix per effector-family gateway is
   required before deployment. Owned by `will-compliance-officer`.
6. **Coordinator discipline in plugins stays.** DEA is architecturally
   above plugins; plugins remain ingest-only with `TestNoTaskingSurface`.
7. **Attritable-first rollout.** The first DEA gateway targets
   friendly attritable systems (Vector-derived loitering munitions or
   equivalent) rather than a manned platform's kinetic path. Attritable
   systems have a materially easier MHC file (no proportionality
   ambiguity vs a manned-platform round). Manned-effector DEA (Skynex,
   Skyranger, MMPV-90 CIWS) requires a second, harder co-sign cycle.

## Alternatives considered

- *Stay coordinator-only forever.* Rejected — makes WILL irrelevant at
  swarm tempo, exactly where the SAFE-funded C-UAS batteries need
  coordination most.
- *Allow direct click-and-fire from a UI, gated by RBAC only.* Rejected
  — breaks MHC (no substantive prior human commitment, just a
  per-action click) and creates a click-fatigue attack surface. Also
  turns any UI compromise into a kinetic compromise.
- *Full autonomy — no human envelope, only ROE rules.* Rejected on IHL,
  EU AI Act, and Romanian legal grounds. The named commander signature
  is not optional.
- *Push envelopes through the existing `tak-gateway` bidirectional
  path.* Rejected — TAK Server is a picture bridge, not an authority
  bridge. Mixing engagement authorisation with picture sharing conflates
  two very different accreditation surfaces.
- *Envelope depth uncapped by default.* Rejected — re-delegation without
  explicit cap dilutes accountability. Default depth = 0 (single-level)
  forces a commander to think about whether they want re-delegation
  before it can happen.

## Consequences

- New service: `services/will-doctrine` (envelope authoring API,
  lifecycle, rules-engine host, event emitter).
- New service family: `services/authorisation-gateway-<vendor>` (one per
  effector family; first is `authorisation-gateway-vector` on the
  attritable side).
- New schemas: `will.envelope.v0`, `will.dea.event.v0`.
- New tests: `TestDEAInvariants` (encodes the six forbidden cases
  above); `TestEnvelopeExpiryHonouredWithinBusRoundTrip`;
  `TestAbortPropagatesToAllGateways`; `TestClickAndFireImpossible`.
- New UX: envelope-authoring screens in the tenant admin UI
  (`will-frontend-tenant-ux`); commander duty screen with envelope
  timers and prominent abort (`will-frontend-cesium` overlay).
- New compliance file per effector-family gateway (AI Act + ORNISS +
  MHC).
- ADR-018 plugins are unchanged. The coordinator discipline in plugins
  remains a load-bearing invariant precisely because DEA lives above
  them.
- Programme delivery: attritable-first DEA is a candidate for a
  post-Link-22 sprint window; manned-effector DEA is later and
  co-sign-heavier.

## Status

**Proposed.** No code, no envelope schema, no `will-doctrine` service,
and no authorisation gateway may land in the tree until all six
co-signs are recorded:

- Tech Lead — architecture, `will.envelope.v0` shape, gateway pattern
- Compliance Officer — EU AI Act conformity file, ORNISS appendix per
  gateway
- Security Engineer — signature model, abort tier design, blast-radius
  analysis
- Product Owner — envelope-authoring UX, roll-out order (attritable
  first)
- Programme Manager — co-fund dependency with the effector-family
  vendor certification cycle
- Legal counsel (RO MoD JAG or equivalent) — MHC formulation, chain of
  command mapping, records retention for post-action review

The order of enforcement matters: Legal + Compliance sign first (the
doctrinal spine); Security + Tech Lead second (the technical
implementation); PO + Programme Manager last (roll-out). Any single
missing sign-off blocks the entire ADR.
