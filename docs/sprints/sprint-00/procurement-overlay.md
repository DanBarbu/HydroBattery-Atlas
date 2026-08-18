# Sprint 0 — Procurement & Interoperability Overlay

**Authored by:** will-scrum-master-alpha (NATO procurement & interoperability) and will-scrum-master-bravo (innovation procurement).
**Audience:** Programme Manager, Product Owner, Tech Lead — and the demo audience on Day 13.

---

## 1. The honest bottom line

Sprint 0 produces **no funding-bearing artefact directly**. It produces the platform skeleton on which every later funding-eligible deliverable rests. Saying so out loud at the Day 13 review is part of the discipline; we are not going to oversell foundations.

That said, four Sprint 0 outputs feed durable procurement-readiness streams:

| Sprint 0 output | Procurement / interop relevance |
|---|---|
| `tracks` schema with `classification` column (S0-03) | Foundation for STANAG 4774 confidentiality labels — required for FMN Spiral 4 (Sprint 14) and ORNISS pre-accreditation file (Sprint 11). |
| Plugin scaffolding (S0-04) | Foundation for the Plugin SDK (Sprint 1) — itself the candidate vehicle for DIANA cohort entry, NIF investment thesis, and EDF "disruptive technologies" calls. |
| GitLab CI scan policy (S0-08) | Foundation for SBOM (CycloneDX) per release — required for **EU Cyber Resilience Act** compliance and a likely SAFE-eligibility evidence item. |
| ADR repo with ADR-005 STANAG 4774 (S0-09) | Foundation for the architectural evidence pack required by AQAP 2110 / 2210 and ORNISS. |

---

## 2. Funding-instrument map (current as of the work plan)

| Instrument | Active call window relevant to WILL? | Sprint 0 contribution |
|---|---|---|
| **SAFE** (Reg. (EU) 2025/1142) | Engagement begins once Romania commits to a joint procurement under SAFE; we track the Council schedule | None directly; later Bill of Origin process (Sprint 12) depends on the plugin registry foundation we'll start building |
| **EDF** (2021/697) | Annual calls; relevant tracks are "disruptive technologies" and "digital transformation" | Indirect — provides the architectural baseline EDF reviewers expect to see |
| **EDIRPA** (2023/2418) | Joint procurement (3+ MS); active calls | None directly; Charlie's multi-tenancy in Sprint 3 is the EDIRPA hook |
| **EDIP** (proposed) | Pending legislative process | Watch and wait |
| **PESCO** | Multiple active projects RO participates in | Indirect; FMN-aligned outputs in later sprints fit several PESCO projects |
| **NSPA** | Framework agreements; possible WILL listing in 18-24 months | None directly |
| **NIF (NATO Innovation Fund)** | Open to applications continuously | Indirect; the Plugin SDK and edge stack are the credible NIF thesis |
| **NATO DIANA** | Annual cohort calls; priority areas published yearly | Indirect; Bravo/Charlie can compete in **secure communications, autonomy, sensing** tracks once Plugin SDK + edge mesh are demonstrable (Sprints 5–8) |
| **MApN Innovation Cell** (forming) | Lighter-touch contracts; PoC scale | Indirect; first credible PoC is end of Sprint 1 |
| **FMS (US)** | Programme-by-programme | Out of scope for Sprint 0 |
| **OUG 114/2011 / Law 98/2016** (RO national) | Programme-by-programme | Out of scope for Sprint 0 |

---

## 3. Interoperability standards posture after Sprint 0

| Standard | Sprint 0 posture | Earliest sprint we have evidence for |
|---|---|---|
| STANAG 5516 (Link-16) | Not yet | Sprint 1 (planning) → Sprint 8 (operational) |
| STANAG 5522 (Link-22) | Not yet | Sprint 8 |
| STANAG 4607 (GMTI) | Not yet | Sprint 3 |
| STANAG 4609 (FMV) | Not yet | Sprint 6+ |
| STANAG 4586 (UAV) | Not yet | Sprint 2 (MAVLink kickoff) |
| STANAG 4774 / 4778 (labels) | **Foundational column in `tracks` table — Sprint 0** | Full crypto binding Sprint 9 |
| APP-6D | **Single friendly land symbol — Sprint 0** | Full library Sprint 9+ |
| APP-11 | Not yet | Sprint 6 |
| FMN Spiral 4 | Not yet | Sprint 14 |
| MIP 4 | Not yet | Sprint 14 |
| AQAP 2110 / 2210 | **ADR repo + DoD discipline — Sprint 0** | Quality plan formalised Sprint 13 |
| NAF v4 architectural views | **First five ADRs — Sprint 0** | Full views Sprint 11 |

The pattern: in Sprint 0 we put the **column / hook / scaffolding** in place for every standard we will eventually have to certify against. We never close a standard off in Sprint 0; we just refuse to build a foundation that would later make it expensive to honour one.

---

## 4. Cohort-cycle calendar (rolling 6 months)

> The Scrum Masters maintain this overlay; it is reviewed at every sprint review.

| Month | Window opens | Window closes | Instrument | What we would submit |
|---|---|---|---|---|
| M+1 | DIANA 2026 cohort intake (illustrative) | T-90 days | DIANA | Plugin SDK pitch (premature for Sprint 0; revisit at end of Sprint 4) |
| M+2 | EDF disruptive-tech call (illustrative) | rolling | EDF | Consortium-led; we'd be a Romanian partner |
| M+3 | NIF deal-flow review | continuous | NIF | Spin-out option for Plugin SDK + edge stack |
| M+4 | EDIRPA joint procurement window | per call | EDIRPA | Multi-tenant theming for shared C2 across MS |
| M+5 | MApN Innovation Cell PoC tender | per tender | National | First credible PoC (end Sprint 1, hardened by Sprint 4) |

**Sprint 0 action arising from this calendar:** none. Sprint 0 is too early to submit anything credible.
**Sprint 0 risk arising from this calendar:** the team may feel pressure to show innovation-grade material before Sprint 4. The Scrum Masters absorb that pressure.

---

## 5. Plugin procurement classification matrix — initial entry

The Scrum Masters seed the matrix with the only "plugin" we ship in Sprint 0 (the simulated GPS), so the discipline is in place when real plugins arrive in Sprint 1.

| Plugin | Funding-eligibility | Origin profile | Export-control regime | RO classification | NATO equivalence | Interop evidence |
|---|---|---|---|---|---|---|
| `sim-gps-puck` (S0-04) | N/A — internal demo only, not for sale | 100 % EU (developed in Romania) | None | NESECRET | UNCLASSIFIED | None — pre-SDK; promoted to gRPC SDK contract in Sprint 1 |

The matrix is committed at `docs/procurement/plugin-classification-matrix.md` (created Sprint 1).

---

## 6. What the Scrum Masters tell the demo audience on Day 13

> *Sprint 0 is foundations. We are not asking for funding eligibility today. We are showing that the floor is poured and level — classification metadata is structural, not decorative; Bill of Origin discipline starts when the plugin registry exists; the standards we will later have to certify against (STANAG 4774, FMN Spiral 4, AQAP 2110) all have their hooks in this sprint. By Sprint 4 we will have something credible to put in a DIANA cohort pitch. By Sprint 14 we will have something credible to put in front of NCIA for FMN conformance. Today, we ship a moving icon on a globe — and a clear, honest, written architecture under it.*
