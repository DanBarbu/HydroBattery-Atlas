# Sprint 1 — Procurement & Interoperability Overlay

**Authored by:** will-scrum-master-bravo (innovation procurement) and will-scrum-master-alpha (NATO interoperability framing)

## 1. The honest bottom line

Sprint 1 is the first sprint that produces a **funding-credible kernel**: the Plugin SDK contract plus a first real sensor (ATAK-MIL CoT). Together they give us a one-page narrative for innovation funders ("any sensor in under four hours; demonstrated with a real ATAK-MIL feed") and a defence-realistic demo for procurement audiences.

We are still not eligible for SAFE funding (no Bill of Origin process yet — Sprint 12 plugin registry adds it) and we cannot yet enter NCIA contracting (no STANAG conformance evidence yet — Sprint 3 STANAG 4607, Sprint 14 FMN Spiral). But we have moved from "foundations" to "first credible artefact".

## 2. Sprint 1 outputs vs funding instruments

| Sprint 1 output | Funding-instrument relevance |
|---|---|
| `will.sensor.v1` Plugin SDK contract | **DIANA cohort pitch kernel.** Standardised, contract-driven sensor onboarding is exactly what cohort calls in *autonomy* and *secure communications* tracks ask for. |
| `plugin-loader` with health and registry | **NIF investment thesis kernel.** A platform that absorbs heterogeneous sensors via a typed contract is the dual-use story NIF underwrites. |
| ATAK-MIL adapter and CoT decoder | **NATO interoperability evidence kernel.** Shows we read US-origin tactical messaging today; sets up STANAG / FMN evidence in later sprints. |
| Bilingual tutorial | **MApN Innovation Cell readiness signal.** Romanian-language onboarding lowers the friction for the local SME ecosystem the Innovation Cell wants to nurture. |
| `cot-replay` synthetic generator | **Conformance-test asset.** The same generator becomes the CI-driven conformance baseline for any future CoT-handling plugin. |

## 3. Cohort-cycle calendar — Sprint 1 view

| Window | Deadline relative to Sprint 1 end | Submission readiness |
|---|---|---|
| DIANA next intake (illustrative) | ~3 months out | One-page narrative drafted; pitch deck ready by Sprint 4 |
| NIF deal-flow review | continuous | Investment teaser one-pager — first version drafted by will-scrum-master-bravo at end of sprint |
| EDF disruptive-tech call | next call ~6 months out | We need a consortium; will-programme-manager makes the contact at the next industry-day |
| EDIRPA joint procurement | per call | Awaits Sprint 3 multi-tenancy work |
| MApN Innovation Cell PoC | per tender | First credible PoC — *this sprint* |

## 4. Plugin procurement classification matrix — updates

| Plugin | Funding eligibility | Origin | Export-control | RO marking | NATO equivalence | Interop evidence |
|---|---|---|---|---|---|---|
| `sim-gps-puck` (S0-04) | Internal demo | 100 % EU/RO | None | NESECRET | NATO_UNCLASSIFIED | None |
| `reference-echo` (S1-02) | Internal demo + tutorial | 100 % EU/RO | None | NESECRET | NATO_UNCLASSIFIED | None |
| `atak-mil` (S1-05) | DIANA / NIF / MApN Innovation Cell candidate | 100 % EU/RO (decoder is in-house, not a US import) | EAR99 boundary check (we do not redistribute ATAK; we read its emitted CoT) | NESECRET | NATO_UNCLASSIFIED | CoT (de facto), partial APP-6D affiliation mapping |
| `cot-replay` (S1-05 demo aid) | Internal | 100 % EU/RO | None | NESECRET | NATO_UNCLASSIFIED | n/a |

The Compliance Officer ratifies this table at the Day 13 review.

## 5. What the Scrum Masters tell the demo audience on Day 13

> *Sprint 1 is the first sprint with a real customer-facing artefact. The Plugin SDK contract is the crown jewel; the ATAK-MIL adapter is the proof. We did not bake any STANAG conformance into Sprint 1 — that lands in Sprint 3 (STANAG 4607) and Sprint 14 (FMN Spiral 4). We did not commit to a Bill of Origin process — that lands in Sprint 12 with the plugin registry. What we DID do: we made it possible for a developer who has never seen WILL to write a working sensor plugin in 45 minutes, in Romanian or English. That is the kernel of every funding conversation we will have over the next 18 months.*
