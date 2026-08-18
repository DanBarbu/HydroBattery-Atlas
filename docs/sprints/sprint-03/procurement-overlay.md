# Sprint 3 — Procurement & Interoperability Overlay

**Authored by:** will-scrum-master-alpha (NATO interoperability) and will-scrum-master-bravo (innovation procurement)

## 1. The honest bottom line

Sprint 3 is the first sprint that ships **a NATO standard end-to-end**. STANAG 4607 GMTI is not a thought experiment any more — packets in, target reports decoded, distinctive symbology rendered, plugin survives malformed input. That changes the conversation we can have with NCIA, NSPA, and any allied integrator.

It is also the sprint that makes the **CPG/STS profile credible** to a customer for the first time, because the air-gap mirror procedure now has a written, signed-off, rehearsed runbook.

We are still pre-RBAC (Sprint 4), pre-FMN-Spiral conformance (Sprint 14), and pre-plugin-registry / Bill of Origin (Sprint 12). But we are now NATO-interoperable on **one** standard, and the procurement story tightens accordingly.

## 2. Sprint 3 outputs vs funding instruments

| Output | Relevance |
|---|---|
| STANAG 4607 decoder and plugin (S3-01, S3-02) | **NSPA / NCIA evidence kernel.** The first NATO interoperability standard implemented end-to-end. The fuzz test result ("zero decoder crashes in 30 s on every PR") is the kind of artefact AQAP 2110 reviewers look for. |
| Track schema extension (S3-03) | **Per-family analytics.** GMTI volumes are the headline metric for any radar-adjacent contract conversation. |
| GMTI symbology + layer toggle (S3-05) | **Operator-facing differentiator.** Anyone who has used Lattice, Maven, or Helsing recognises the layered COP; we now have ours. |
| `gmti-replay` synthetic generator (S3-04) | **Conformance-test asset.** Same role `cot-replay` plays for ATAK-MIL: a reproducible CI driver and demo aid. |
| ADR-006 (per-tenant DB compartments) | **ORNISS pre-accreditation evidence.** Documented isolation control for high classification. |
| Air-gap mirror procedure | **CPG/STS profile credibility.** No procurement conversation about classified deployment progresses without this. |
| Plugin Info terminology overrides | **White-label depth.** Aerostar's Sprint 2 ask closed. |

## 3. Cohort-cycle calendar — Sprint 3 view

| Window | Deadline relative to Sprint 3 end | Submission readiness |
|---|---|---|
| DIANA next intake | ~8 weeks out | Pitch deck v1 (started Sprint 2) updated with Sprint 3 STANAG 4607 outputs by Day 12 |
| NIF deal-flow review | continuous | One-pager (Sprint 1) refreshed with the NATO interoperability bullet |
| EDF disruptive-tech call | ~3 months out | Consortium contact made; PM scoping a Romanian SME + a Dutch / Italian partner |
| EDIRPA joint procurement | per call | Multi-tenancy + air-gap procedure now a credible joint-procurement story |
| MApN Innovation Cell PoC | per tender | First credible PoC since Sprint 1; Sprint 3 STANAG addition strengthens the bid |

## 4. Plugin procurement classification matrix — updates

| Plugin | Funding eligibility | Origin | Export-control | RO marking | NATO equivalence | Interop evidence |
|---|---|---|---|---|---|---|
| `gmti` | NSPA / DIANA sensing / EDF disruptive-tech / MApN | 100 % EU/RO (in-house decoder) | EU 2021/821 dual-use review pending; Compliance Officer signs off in Sprint 3 | NESECRET | NATO_UNCLASSIFIED | **STANAG 4607 (Edition 3) WILL minimal profile** |
| `gmti-replay` | Internal | 100 % EU/RO | None | NESECRET | NATO_UNCLASSIFIED | n/a |

The Compliance Officer ratifies this row at the Day 13 review.

## 5. What the Scrum Masters tell the demo audience on Day 13

> *Sprint 3 is the sprint that turns WILL from "credible product" into "NATO-interoperable product on one standard." STANAG 4607 GMTI from packet to globe with distinctive symbology and radial velocity in the label, hardened against malformed input, with the operational support to deploy into an air-gapped classified environment. The next conversation we can have at NSPA is materially different from last sprint's conversation. We did not build RBAC (Sprint 4), did not implement FMN Spiral 4 (Sprint 14), and did not ship the plugin registry (Sprint 12). What we did build: WILL is now the only sovereign Romanian C2 we know of that ingests NATO GMTI packets, period.*
