# Sprint 4 — Procurement & Interoperability Overlay

**Authored by:** will-scrum-master-bravo (innovation procurement) and will-scrum-master-alpha (NATO interop)

## 1. The honest bottom line

Sprint 4 turns three things from "designed" into "real and demonstrable": **multi-tenant white-label**, **scale-tested IoT ingest**, and **role-gated APIs**. Together with the air-gap drill calendar and the OPA Gatekeeper dry-run, this sprint moves the Romanian classified-deployment conversation from "we have a plan" to "we have signed-off operational artefacts."

We are still pre-NPKI (Sprint 10) and pre-FMN-Spiral conformance (Sprint 14); SAFE eligibility waits on the Sprint 12 plugin registry. Operationally, however, every Sprint-4 output goes on a procurement slide.

## 2. Sprint 4 outputs vs funding instruments

| Output | Relevance |
|---|---|
| `lora-bridge` + `lora-sim` (100 nodes) (S4-01, S4-05) | **DIANA sensing track + EDF disruptive-tech.** Heterogeneous IoT density is exactly what the cohort calls ask for. |
| `tenant-admin` Sensors and Members tabs (S4-02, S4-03) | **EDIRPA hook completed.** Tenant-scoped RBAC on top of Sprint 2's white-label tenancy is the joint-procurement story. |
| RBAC schema + middleware (S4-03) | **AQAP 2110 / ORNISS evidence kernel.** Documented role catalogue; deny-by-default authoriser; auditable membership tables. |
| KMS stub (S4-04) | **Sprint 10 Vault drop-in.** The production wrapper is interface-compatible. |
| V0005 RLS preview | **ADR-006 evidence.** Defence-in-depth at the database layer; ORNISS reviewers explicitly look for this. |
| Brigada Demo seed (S4-06) | **MApN Innovation Cell PoC kit.** Idempotent loader; Romanian-first theme + terminology; single command to demo. |
| Air-gap drill calendar | **STS / ORNISS confidence-builder.** The procedure is signed; the calendar is the evidence the procedure runs. |
| OPA Gatekeeper dry-run | **Cosign-required policy live in the cluster.** Sprint 9 flips to enforce. |
| RAT-31DL benchmark | **Sprint 5 real-radar test unblocked.** No decoder surprises. |

## 3. Cohort-cycle calendar — Sprint 4 view

| Window | Deadline relative to Sprint 4 end | Submission readiness |
|---|---|---|
| DIANA next intake | ~6 weeks out | Pitch deck v2 with Sprint 4 LoRa + RBAC + Brigada Demo bullets ready for PM review by Day 12 |
| NIF deal-flow | continuous | One-pager refreshed; Sprint 4 metrics (100-node E2E pass; tenant-scoped RBAC) added |
| EDF disruptive-tech | ~10 weeks out | Consortium scoping conversation underway with Aerostar + a Dutch SME |
| EDIRPA joint procurement | per call | Multi-tenancy + RBAC + white-label = end-to-end EDIRPA story |
| MApN Innovation Cell PoC | per tender | Brigada Demo seed is the canonical PoC artefact |

## 4. Plugin & service procurement classification matrix — updates

| Plugin / Service | Funding eligibility | Origin | Export-control | RO marking | NATO equivalence | Interop evidence |
|---|---|---|---|---|---|---|
| `lora-bridge` | DIANA / EDF / MApN | 100 % EU/RO (paho.mqtt.python is OSS) | EAR99 boundary | NESECRET | NATO_UNCLASSIFIED | LoRaWAN (open standard) — ChirpStack v3+v4 + WILL-native shapes |
| `lora-sim` | Internal | 100 % EU/RO | None | NESECRET | NATO_UNCLASSIFIED | n/a |
| `kms-stub` | Internal (Sprint 4 only); replaced by Vault Sprint 10 | 100 % EU/RO | None | NESECRET | NATO_UNCLASSIFIED | n/a |
| `tenant-admin` (RBAC + Sensors) | EDIRPA / DIANA / EDF / MApN | 100 % EU/RO | None | NESECRET | NATO_UNCLASSIFIED | n/a (control plane; AQAP-traceable role catalogue) |

The Compliance Officer ratifies these rows at the Day 13 review.

## 5. What the Scrum Masters tell the demo audience on Day 13

> *Sprint 4 is the sprint where the platform becomes operationally demonstrable to a customer. Hundreds of low-cost IoT sensors flowing in. Tenant-scoped roles enforcing the boundary between operator and admin. A per-tenant key issued on demand. A full white-label demo tenant a customer can stand up with one shell command. An air-gap drill calendar in the customer's planning tool. A Gatekeeper policy live in the staging cluster. We did not build NPKI auth (Sprint 10), did not wire Vault (Sprint 10), did not implement FMN Spiral (Sprint 14), and did not flip Gatekeeper to enforce (Sprint 9). What we did build: every conversation we will have with MApN, NSPA, NCIA, DIANA, NIF, and EDF over the next eight weeks rests on a Sprint 4 artefact.*
