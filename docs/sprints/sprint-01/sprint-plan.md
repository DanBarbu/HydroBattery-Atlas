# Sprint 1 — Sprint Plan

**Facilitators:** will-scrum-master-bravo (Bravo+Charlie), will-scrum-master-alpha (Alpha + joint refinement)
**Product Owner:** will-product-owner
**Tech Lead:** will-tech-lead
**Sprint window:** [Insert dates at planning]

---

## 1. Sprint Goal

> Demonstrate a real ATAK-MIL CoT feed flowing through the **first version of the WILL Plugin SDK contract** (`will.sensor.v1`), into a **plugin loader** that registers and supervises plugins, onto the EMQX bus, and out through the WebSocket bridge to the dashboard — where the operator's track renders with the correct APP-6D affiliation colour, callsign label, and a live Plugin Info panel.

A backup synthetic CoT replay container ships alongside the live feed so the demo and CI integration test never depend on a tablet being on the network.

---

## 2. Capacity

| Engineer | Squad | Available days | Notes |
|---|---|---|---|
| Backend Plugins-1 | Bravo | 10 | Owns the Plugin SDK contract (PBI 101, 102, 103) |
| Backend Plugins-2 | Bravo | 10 | Owns ATAK-MIL adapter and CoT parser (PBI 104, 105, 106) |
| Backend Core-1 | Alpha | 10 | EMQX topic widening, integration with bridge |
| Backend Core-2 | Alpha | 9 | Auth tokens for the loader API; Sprint 1 placeholder |
| Backend TDL | Alpha | 8 | Spike on STANAG 4607 readiness for Sprint 3 |
| Frontend Tenant-UX | Charlie | 10 | Plugin Info panel (PBI 108) and i18n extension |
| Frontend Cesium | Charlie | 10 | Affiliation rendering + Sprint 0 retro action #1 (flicker) |
| Frontend APP-6D | Charlie | 10 | Affiliation colour mapping (Sprint 9 library still future) |
| DevOps Cloud | Cross-cutting | 10 | Compose wiring; CI updates |
| DevOps On-Prem | Cross-cutting | 5 | Air-gap mirror updates for new images |
| Security Engineer | Cross-cutting | 8 | Plugin loader review; Sprint 0 retro action #3 |
| QA Automation | Cross-cutting | 10 | Loader unit + integration; CoT fuzz tests |
| QA HIL | Cross-cutting | 8 | Field test prep with the CCOSIC SME's tablet |
| Tech Writer | Cross-cutting | 8 | Tutorial RO/EN (PBI 109); README updates |

**Total available:** 116 person-days. Forming-team penalty over (Sprint 0 was the floor); planned commitment **52 person-days of focused PBI work** ≈ 41 SP.

---

## 3. Sprint Backlog

### S1-01 — gRPC `SensorPlugin` service definition
**Owner:** Backend Plugins-1
**Estimate:** 5 SP
**Acceptance:**
- `contracts/proto/will/sensor/v1/sensor.proto` defines Describe/Health/Configure/Telemetry.
- `buf lint` passes; `buf breaking` runs in CI against the previous tag (no previous tag → no breaking check this sprint).
- ADR-002 referenced in the file header.
- `contracts/README.md` documents versioning policy and stub-generation flow.
**Dependencies:** None.

### S1-02 — Reference echo plugin (Python)
**Owner:** Backend Plugins-1
**Estimate:** 3 SP
**Acceptance:**
- `plugins/reference-echo/` ships a runnable Python plugin emitting one canned track per second.
- Demonstrates Describe / Health / Configure / Telemetry shapes.
- Containerised; included in `docker compose up`.
- Documented as the canonical starting point in the tutorial (PBI S1-09).
**Dependencies:** S1-01 contract shape.

### S1-03 — Plugin loader with unit tests
**Owner:** Backend Core-1 (loader package), QA Automation (test harness)
**Estimate:** 5 SP
**Acceptance:**
- `services/plugin-loader/` Go service exposes `/healthz` and `/v1/plugins`.
- `internal/loader/` package with table-driven unit tests covering: happy path, contract-version mismatch rejection, dial error, telemetry-pump → bridge, health-loop status transitions.
- `internal/registry/` package with concurrency tests.
- Test coverage on `loader` and `registry` packages ≥ 75 %.
**Dependencies:** S1-01 contract shape.

### S1-04 — CoT XML parser
**Owner:** Backend Plugins-2
**Estimate:** 8 SP
**Acceptance:**
- `plugins/atak-mil/internal/cot/` decodes friendly, hostile, neutral, and unknown CoT events.
- Hostile inputs do not crash: empty, oversized (>64 KiB), malformed XML, missing required attributes, out-of-range coordinates, XXE attempts.
- Fuzz test (`go test -fuzz`) runs in CI for 30 seconds per PR.
- Maps CoT type → APP-6D affiliation and dimension (Sprint 1 narrow mapping; full library Sprint 9).
**Dependencies:** None.

### S1-05 — ATAK-MIL adapter plugin
**Owner:** Backend Plugins-2
**Estimate:** 8 SP
**Acceptance:**
- `plugins/atak-mil/cmd/atak-mil` listens on UDP `0.0.0.0:8087`.
- Decodes received CoT, transforms to v0 track payload via the `forward` package, publishes to EMQX `telemetry/cot/atak-mil`.
- Survives malformed packets (logs and continues); never crashes the process.
- Compose wiring includes the adapter and the synthetic `cot-replay` container.
**Dependencies:** S1-04.

### S1-06 — Field test with one ATAK-MIL tablet
**Owner:** QA HIL with Backend Plugins-2
**Estimate:** 5 SP
**Acceptance:**
- Test plan written: [`docs/field-tests/sprint-01-atak-mil.md`](../../field-tests/sprint-01-atak-mil.md).
- Test executed against the CCOSIC SME's tablet (committed at Sprint 0 review) or, if scheduling slips, in the lab Faraday cage with a developer device.
- PCAP and screen-recording captured and stored in the test-evidence bucket.
- All Pass criteria from the test plan met.
**Dependencies:** S1-05 deployed in dev environment; tablet logistics confirmed at Day 3.

### S1-07 — Frontend renders any plugin track
**Owner:** Frontend Cesium with Frontend APP-6D
**Estimate:** 3 SP
**Acceptance:**
- Globe renders tracks from any plugin (not only the Sprint 0 GPS simulator).
- Affiliation drives colour (friendly blue, hostile red, neutral green, unknown yellow).
- Sprint 0 retro action #1 (Cesium first-load flicker) closed: viewer waits for first frame before opening the WebSocket.
**Dependencies:** S1-05 producing v0 track payloads.

### S1-08 — Plugin info panel
**Owner:** Frontend Tenant-UX
**Estimate:** 2 SP
**Acceptance:**
- Side panel polls `/v1/plugins` every 5 s and renders name, version, contract version, status, latency.
- Colour-codes status (SERVING green, DEGRADED yellow, NOT_SERVING/UNKNOWN red).
- Bilingual strings; error state when API unreachable.
- a11y: panel is reachable via keyboard navigation; status changes announced via `aria-live`.
**Dependencies:** S1-03.

### S1-09 — "Write your first plugin" tutorial (RO/EN)
**Owner:** Tech Writer with Backend Plugins-1
**Estimate:** 5 SP
**Acceptance:**
- [`docs/plugins/first-plugin-tutorial.md`](../../plugins/first-plugin-tutorial.md) covers prerequisites, contract overview, copy-the-reference, edit-Describe, implement-Telemetry, validate locally, conformance.
- Bilingual: full RO and full EN; reviewed by a Romanian-native engineer.
- Common mistakes section.
- Cross-links to ADR-002 and ADR-005.
**Dependencies:** S1-01, S1-02.

---

## 4. Total commitment

| Story | SP |
|---|---|
| S1-01 | 5 |
| S1-02 | 3 |
| S1-03 | 5 |
| S1-04 | 8 |
| S1-05 | 8 |
| S1-06 | 5 |
| S1-07 | 3 |
| S1-08 | 2 |
| S1-09 | 5 |
| **Total** | **44 SP** |

Slightly above the 41 SP target — Tech Lead authorised the +3 SP because the two extra story points sit on the field-test story (S1-06), where slippage is tolerable.

---

## 5. Dependency map

```
S1-01 contract ──┬─> S1-02 reference plugin ──┐
                 └─> S1-03 plugin loader ─────┼─> S1-08 plugin info panel
                                              │
S1-04 cot parser ──> S1-05 atak-mil adapter ──┴─> S1-07 frontend renders any track
                                              └─> S1-06 field test
S1-09 tutorial — depends on S1-01 + S1-02
```

Critical path: **S1-04 → S1-05 → S1-06**.

---

## 6. Sprint risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Tablet logistics slip the field test | Medium | Synthetic `cot-replay` container always available; field test moves to Cincu half-day or lab Faraday cage |
| Contract debate consumes Day 1–2 | Medium | Tech Lead reviews S1-01 ADR-aligned, time-boxed to half a day |
| CoT fuzz finds a parser crash bug late | Low | Fuzz starts Day 4; bug fix is well within sprint slack |
| Cross-squad refinement misses a UX field | Low | Joint refinement scheduled before Day 1 (Sprint 0 retro action #2) |
| Loader test coverage stuck below 75 % | Low | QA Automation pairs with Backend Core-1 on Day 5 |
| Sprint 0 flicker fix breaks WebSocket reconnect | Low | Frontend Cesium ships a regression test for reconnect alongside the fix |

---

## 7. Sprint-1 specific Definition of Done additions

(In addition to the standing DoD.)

- Every plugin's image is signed with Cosign in CI before push.
- The Plugin SDK contract change passes `buf lint`; if a breaking change is intentional, the Tech Lead, Security Engineer, and Compliance Officer all approve the PR.
- The tutorial is verified end-to-end: a developer not on Squad Bravo follows it and produces a working plugin within the documented time budget.

---

## 8. Out of scope for Sprint 1

- mTLS between loader and plugins — Sprint 10.
- Tenant-scoped rate limiting on plugin telemetry — Sprint 4.
- Plugin marketplace UI — Sprint 12.
- Effector contracts (`will.effector.v1`) — Sprint 3.
- Per-track classification banner rendering — Sprint 9.
- Full APP-6D library — Sprint 9.

---

## 9. Carry-overs from Sprint 0 retrospective

1. **Cesium first-load flicker** (Frontend Cesium, S1-07 acceptance includes the fix; success measure: zero flicker on three reference VM types verified by QA Automation at the Sprint 1 review).
2. **Cross-squad refinement timing** (both Scrum Masters, scheduled before Sprint 1 Day 1; success measure: confirmed scheduled and held).
3. **Faster security review loop** (Security Engineer + both SMs; success measure: any schema/crypto/auth/audit-touching PR reviewed within 24 h; tracked on the impediments log).
