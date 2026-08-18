# Sprint 2 — Procurement & Interoperability Overlay

**Authored by:** will-scrum-master-bravo (innovation procurement) and will-scrum-master-alpha (NATO interoperability framing)

## 1. The honest bottom line

Sprint 2 produces the first two **commercially distinctive** capabilities of WILL: **white-label multi-tenancy** (the OEM story) and **MAVLink UAV ingest** (the autonomy story). Together with Sprint 1's Plugin SDK, this sprint completes the kernel that funders and procurement audiences both want to see.

We are still not SAFE-eligible (no plugin registry / no Bill of Origin pipeline yet — Sprint 12), and we are still pre-FMN (Sprint 14). But Cosign signing in CI is the first concrete artefact in the SAFE evidence chain, and the white-label admin is the first artefact that lets a Romanian prime credibly OEM the platform.

## 2. Sprint 2 outputs vs funding instruments

| Output | Relevance |
|---|---|
| `tenants` schema + tenant-admin service + Admin UI | **EDIRPA hook.** Multi-MS joint procurement requires per-MS isolated tenancy — this is exactly that. |
| White-label theming (primary colour, banner, affiliation overrides) | **Industry-prime OEM enabler.** Romanian primes (ROMARM, Aerostar, Romaero) can OEM WILL under their own brand for downstream contracts. |
| MAVLink plugin + `mavlink-sim` | **DIANA autonomy track + NIF dual-use thesis.** MAVLink is the open de-facto standard for unmanned platforms; supporting it credibly is table stakes for autonomy funding. |
| Cosign signing in CI | **SAFE Bill of Origin foundation.** Every signed image becomes a row in the Bill of Origin that Sprint 12 formalises. |
| Theming guide (RO/EN) | **Pilot-readiness.** A Romanian-language theming guide cuts a half-day from any pilot kick-off. |
| Loader registry stress test | **Plugin-density credibility for cohort pitches.** "Verified at 1 000 plugins" is the kind of number a DIANA / NIF pitch deck wants. |

## 3. Cohort-cycle calendar — Sprint 2 view

| Window | Deadline relative to Sprint 2 end | Submission readiness |
|---|---|---|
| DIANA next intake | ~10 weeks out | Pitch deck draft starts at end of Sprint 2; Sprint 4 is the natural submission target |
| NIF deal-flow review | continuous | One-pager (Sprint 1 retro action #3) shipped this sprint; PM circulating to network |
| EDF disruptive-tech call | ~5 months out | Consortium discussions queued for Sprint 4 |
| EDIRPA joint procurement | per call | Multi-tenancy now viable; PM scopes the conversation with two friendly MS |
| MApN Innovation Cell PoC | per tender | First PoC available; PM exploring next tender window |

## 4. Plugin procurement classification matrix — updates

| Plugin | Funding eligibility | Origin | Export-control | RO marking | NATO equivalence | Interop evidence |
|---|---|---|---|---|---|---|
| `sim-gps-puck` | Internal demo | 100 % EU/RO | None | NESECRET | NATO_UNCLASSIFIED | None |
| `reference-echo` | Internal demo + tutorial | 100 % EU/RO | None | NESECRET | NATO_UNCLASSIFIED | None |
| `atak-mil` | DIANA / NIF / MApN Innovation Cell | 100 % EU/RO (decoder in-house) | EAR99 boundary | NESECRET | NATO_UNCLASSIFIED | CoT (de facto), partial APP-6D |
| `cot-replay` | Internal | 100 % EU/RO | None | NESECRET | NATO_UNCLASSIFIED | n/a |
| `mavlink` | DIANA autonomy / NIF | 100 % EU/RO (uses pymavlink, BSD) | EAR99 (pymavlink is FOSS) | NESECRET | NATO_UNCLASSIFIED | MAVLink (open standard) |
| `mavlink-sim` | Internal | 100 % EU/RO | None | NESECRET | NATO_UNCLASSIFIED | n/a |

The Compliance Officer ratifies this table at the Day 13 review.

## 5. What the Scrum Masters tell the demo audience on Day 13

> *Sprint 2 is the sprint that turns WILL from "credible kernel" into "credible product." White-label tenancy is the OEM story for our industry partners. MAVLink ingest is the autonomy story for our funders. Cosign signing is the first SAFE-eligibility artefact. We did not build RBAC (Sprint 4), we did not build the plugin registry (Sprint 12), and we did not build STANAG 4607 ingest (Sprint 3). What we did build: in the next pilot kick-off, the customer rebrands the operator view from a JSON editor in 30 seconds, sees their own UAV on the globe within minutes, and the Programme Manager has a one-pager to take to the next NIF conversation tomorrow.*
