# WILL Battle Management Module — Architecture

> Owner: will-tech-lead. Reviewed by: will-security-engineer, will-compliance-officer, will-product-owner.
> ADR: [ADR-008](../adr/ADR-008-bms-module.md).

## Provenance

This module was built **from publicly available information only**. The
capability area was prompted by Anduril's announcement at
<https://www.anduril.com/news/anduril-to-deliver-battle-management-solution-for-missile-defense-in-the-western-pacific>,
which describes — at a public press-release level — a multi-sensor, plug-and-
play battle-management offering for missile defence. Beyond that single
sentence, every design decision, line of code, and document in this module
was authored from first principles informed by NATO doctrine (publicly
available) and Romanian-context defence programmes (publicly available).

No proprietary code, designs, training data, weights, or trade secrets from
any commercial peer were used.

## Where BMS sits in WILL

```
sensors  → plugin-loader → EMQX → core / fusion → tracks
                                                    │
                                                    ▼
                                              ┌──────────┐
                                              │   BMS    │  ← Sprint-5-extension
                                              │ service  │
                                              └──────────┘
                                            scoring + pairing
                                                    │
                                                    ▼
                                          effector plugins
                                       (will.effector.v1)
```

BMS is a **coordinator** and **decision-aid**. The actual fire decision and
command remain on the effector platform. WILL never directly commands a
weapon to fire; it produces an engagement *proposal* that an authorised
operator approves; the effector reports back via the contract.

## Three concepts

- **Effector** — a registered platform with kinematic envelope, location,
  status, and rounds remaining. Surface: `GET/POST /v1/effectors`.
- **Threat** — a computed view over a sensor track plus a priority score
  produced by `internal/scoring`. Surface: `GET /v1/threats`, `POST
  /v1/threats/score`.
- **Engagement** — the state machine that pairs a threat with an effector:
  `PROPOSED → APPROVED/EXECUTING → COMPLETED/ABORTED/REJECTED`. Surface:
  `GET /v1/engagements`, `POST /v1/engagements/propose`,
  `POST /v1/engagements/:id/{approve,abort,complete}`.

## Authority boundary

| Action | Allowed role | Notes |
|---|---|---|
| List effectors / threats / engagements | viewer / operator / auditor / admin | RBAC catalogue from Sprint 4. |
| Register an effector | admin | Tenants register their own assets only. |
| Score a track / propose an engagement | operator / admin | Sprint 6 fusion engine can also call this internally. |
| Approve an engagement | admin | Operator-authority gate. Sprint 10 NPKI binds this to a smart-card identity. |
| Mark an engagement complete or aborted | admin | Effector platform reports completion; operator can issue an abort at any time. |

## Tenant isolation

V0007 schema enables RLS in the same shape as ADR-006: every row carries
`tenant_id`; the BMS binary sets `app.service_bypass='on'` per request after
having set `app.current_tenant_id` from the incoming `X-Will-Tenant` header.

## Auditability

Every engagement transition is persisted with `proposed_at`, `approved_at`,
`completed_at`, and a free-text `notes` field. The Sprint 11 ORNISS pre-
accreditation file consumes these rows as evidence that the operator-
authority gate is structural and reproducible.

## What this module does NOT do

- It does not run fire-control software.
- It does not control kinetic effects directly.
- It does not own real-time interceptor guidance or radar tasking.
- It does not replace the effector platform's own safety interlocks.
