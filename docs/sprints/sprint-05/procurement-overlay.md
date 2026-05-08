# Sprint 5 — Procurement & Interoperability Overlay

**Authored by:** will-scrum-master-bravo (innovation procurement) and will-scrum-master-alpha (NATO interop)

## 1. The honest bottom line

Sprint 5 ships the two artefacts every defence customer asks about within the first ten minutes of any conversation: **"does it work disconnected?"** and **"have you actually tested it on a real radar?"** Cincu closes the second; the edge agent + outbox + sync closes the first.

The OIDC SSO shim accepts the ADR (sets the design boundary) but does not yet ship the binding; that is honest scope-keeping for Sprint 6. The Gatekeeper exempt list and the pen-test calendar are concrete operational artefacts the customer's INFOSEC office will read on Day 1.

We are still pre-NPKI (Sprint 10) and pre-FMN-Spiral (Sprint 14); SAFE eligibility waits on the Sprint 12 plugin registry.

## 2. Sprint 5 outputs vs funding instruments

| Output | Relevance |
|---|---|
| Edge agent + outbox + sync (S5-01..S5-04) | **DIANA disconnected-environments narrative.** The "operational under contested comms" demo NATO-funded calls explicitly look for. |
| Disconnected demo (S5-05) | **NIF dual-use thesis.** Maritime, search-and-rescue, and critical-infrastructure dual-use stories all hinge on offline-first credibility. |
| K3s install script (S5-06) | **MApN Innovation Cell PoC kit.** Range deployment in under 15 minutes from a clean rugged laptop. |
| Cincu live RAT-31DL test (S5-07) | **NSPA / NCIA conversation enabler.** First NATO-standard ingest verified on real hardware in real RF conditions. |
| OIDC ADR-007 + skeleton | **Industry-OEM unblocker.** Aerostar can plan the Sprint 6 binding work in their cluster. |
| Annual pen-test calendar | **ORNISS pre-accreditation evidence.** Documented external assurance cadence. |
| Gatekeeper exempt list per profile | **CPG / on-prem enforce path.** Sprint 6 flips enforce; the boundary is in code. |

## 3. Cohort-cycle calendar — Sprint 5 view

| Window | Deadline relative to Sprint 5 end | Submission readiness |
|---|---|---|
| DIANA next intake | ~4 weeks out | Pitch deck v3 with Sprint 5 disconnected demo + Cincu video by Day 12 |
| NIF deal-flow | continuous | One-pager updated; offline-first becomes the headline |
| EDF disruptive-tech | ~8 weeks out | Consortium scoping with Aerostar + Dutch SME continues |
| EDIRPA joint procurement | per call | Multi-tenancy + RBAC + offline-first = three-MS story credible |
| MApN Innovation Cell PoC | per tender | K3s install + Brigada Demo seed + Cincu test = ready-to-pitch |

## 4. Plugin & service procurement classification matrix — updates

| Plugin / Service | Funding eligibility | Origin | Export-control | RO marking | NATO equivalence |
|---|---|---|---|---|---|
| `edge-agent` | DIANA / NIF / MApN | 100 % EU/RO (modernc.org/sqlite is OSS) | EAR99 | NESECRET | NATO_UNCLASSIFIED |
| `core-sync` | DIANA / EDF | 100 % EU/RO | EAR99 | NESECRET | NATO_UNCLASSIFIED |
| `tenant-admin auth shim (skeleton)` | Internal | 100 % EU/RO | None | NESECRET | NATO_UNCLASSIFIED |

## 5. What the Scrum Masters tell the demo audience on Day 13

> *Sprint 5 is the sprint where every customer's first two questions get a yes. "Does it work disconnected?" — yes; we partition the network in front of you and the operator continues to work, then the outbox drains in seconds. "Have you tested it on real hardware?" — yes; here is the Cincu drive-through video. We did not ship the OIDC binding (Sprint 6), did not flip Gatekeeper to enforce on the cloud (Sprint 9), and did not deliver NPKI (Sprint 10). What we did ship: the offline-first narrative is now concrete, the Cincu test is on file, and three Sprint-4 carry-overs are closed.*
