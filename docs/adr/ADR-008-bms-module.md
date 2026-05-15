# ADR-008 — Battle Management Solution (BMS) module

- **Status:** Accepted (preview module on top of Sprint 5)
- **Date:** Post-Sprint 5
- **Decider:** Tech Lead, with Backend Core-1, Backend Plugins-1, Backend Plugins-2, Security Engineer, Compliance Officer
- **Consulted:** Product Owner, Programme Manager, CCOSIC SME

## Context

The customer-facing question "can WILL support missile-defence battle management?" recurs in every procurement conversation. Public press material from market peers (notably Anduril's announcement of a battle-management solution for missile defence in the Western Pacific, accessible at <https://www.anduril.com/news/anduril-to-deliver-battle-management-solution-for-missile-defense-in-the-western-pacific>) describes a category whose general capability areas — multi-sensor fusion, threat tracking, engagement decision support, plug-and-play effectors — are public knowledge.

WILL already implements most of this implicitly: Sprint 1 ATAK-MIL, Sprint 2 MAVLink, Sprint 3 STANAG 4607, Sprint 4 LoRa multi-tenant, Sprint 5 offline-first edge. What it lacks is **threat scoring** and **engagement workflow** as first-class concepts.

## Decision

We add a **Battle Management** module on top of the existing platform. Scope, structurally:

1. **A new contract `will.effector.v1`** — gRPC service for effector plugins (SAM batteries, jammers, coastal launchers). The Plugin SDK already supports `will.sensor.v1`; effectors complete the kit promised in the Sprint 1 ADR-002.
2. **A new core service `bms`** — owns three concepts: **threats** (computed views of high-priority hostile tracks), **effectors** (registered platforms with kinematic envelopes and shot inventory), and **engagements** (proposals → operator approval → executing → completed/aborted).
3. **A schema migration `V0007__bms.sql`** — `threats`, `effectors`, `engagements` tables.
4. **A reference effector plugin** — `plugins/sam-battery-mock/` (Patriot-class fire-unit emulator suitable for the Romanian Patriot fleet integration narrative).
5. **A BMS view in the demo-ux app** — Threat board · Effector board · Engagement queue.
6. **Documentation** — architecture, threat scoring methodology, engagement workflow.

The module is structurally additive: nothing in Sprints 0–5 changes shape.

## Important provenance and limits

This module is built **from publicly available information** only — press releases and standard military-doctrine references (NATO STANAG family on engagement coordination, FM-style descriptions of weapon-target pairing). No proprietary code, designs, training data, or trade secrets from any commercial peer were used. The Compliance Officer reviewed this ADR and the implementation notes before acceptance.

We deliberately do **not** ship a kinetic-effects controller. The Engage RPC in `will.effector.v1` returns "would engage" with an estimated probability of kill; the actual fire decision and command remains on the effector platform's own fire-control system. WILL is a coordinator and decision-aid, not a fire-control system. This boundary is explicit in `docs/bms/architecture.md` and in the operator UX (an engagement transitions to `executing` on operator approval but never becomes `completed` automatically — only the effector reports completion).

## Alternatives considered

- **Build full fire-control logic.** Rejected. The accreditation, certification, and liability exposure of a fire-control system is incompatible with the open-core / multi-tenant story.
- **Defer to Sprint 6 fusion sprint.** Rejected. The fusion engine and BMS scoring are different abstractions; coupling them slows both.
- **Reuse existing `will.sensor.v1` for effectors.** Rejected. Effectors have a different lifecycle (Engage is a command, not a passive emission); the contract is genuinely different.

## Consequences

- ADR-002 (gRPC plugin SDK) extends naturally: same versioning policy, same Cosign signing.
- ADR-005 (STANAG 4774 classification) applies: every threat and engagement carries a classification label.
- ADR-006 (per-tenant DB compartments) applies: BMS data is tenant-scoped from row one.
- Sprint 6 fusion engine work consumes BMS threat scores when they are richer than fusion's intrinsic confidence.
- The demo-ux app showcases the BMS workflow without backend integration, which means: a UX reviewer can evaluate the operator experience before the real `services/bms` is plumbed into the production frontend.

## Verification

- `services/bms/internal/scoring/threat_test.go` covers the publicly-documented scoring methodology.
- `services/bms/internal/pairing/pairing_test.go` covers weapon-target pairing rules.
- `services/bms/internal/api/api_test.go` covers the engagement state machine.
- The demo-ux app shows the end-to-end operator workflow.
