# Sprint 4 — Execution Log

**Sprint window:** [Insert real dates at planning]
**Facilitators:** will-scrum-master-bravo (lead), will-scrum-master-alpha (Alpha + DevOps)
**Outcome:** all six PBIs accepted by the Product Owner at the Day 13 review.
**Realised commitment:** 34 SP planned, 34 SP completed. Three Sprint-3 carry-overs all closed.

---

## Day 0 — Joint refinement

Both Scrum Masters held a joint refinement.
- Confirmed `X-Will-Role` header is the Sprint 4 authentication shim; NPKI binding lands in Sprint 10. The Tech Lead noted this in the Sprint 10 backlog.
- Confirmed RLS preview is **defence-in-depth**, not the primary control. Application-layer enforcement remains the user-facing boundary.
- Compliance Officer pre-ratified the Sprint 4 plugin matrix.

## Day 1 — Planning + Kickoff

- Sprint goal locked. Capacity 124 person-days; commitment 34 SP held.
- Tech Lead reserved Days 4–5 for V0005 RLS review.
- Cohort-cycle calendar reviewed: DIANA window 6 weeks out; pitch deck v2 by Day 12.

## Day 2

- **S4-03** — V0004 migration committed; users + user_role ENUM + user_tenants + sensors all green.
- **S4-01** — `lora-bridge` skeleton with ChirpStack v3 shape parsing.
- **Air-gap drill calendar** drafted; Compliance Officer reviewing.

## Day 3

- **S4-04** — `kms-stub` Go service with idempotent get + rotate + tests.
- **S4-01** — `lora-sim` deterministic 100-node scatter.
- **S4-03** — `internal/rbac/` package: `Allow(role, action)` matrix + tests.

## Day 4

- **S4-05** — E2E shell test using `mosquitto_sub` + `jq`. PASS at COUNT=100, WINDOW_S=12.
- **V0005** RLS preview drafted; service-bypass GUC strategy reviewed by Tech Lead and Security Engineer; accepted.
- **S4-02** — `tenant-admin` `internal/sensors/` package; HTTP routes wired.

## Day 5

- **S4-02** — Frontend `SensorAdmin.tsx` working against the backend.
- **S4-03** — Frontend `MembersAdmin.tsx` working; grant + revoke happy paths.
- **OPA Gatekeeper** ConstraintTemplate + Constraint manifests committed.
- **RAT-31DL** benchmark wired; numbers recorded against the customer-supplied capture.

## Day 6 — End of week 1

- **Brigada Demo** seed and idempotent loader committed.
- **End-of-week status to PM:** green.

## Days 7–8 — Weekend

## Day 9

- **OPA Gatekeeper** applied to the staging cluster in dry-run mode; logs visible; verified that an unsigned image triggers a violation entry.
- **RLS test:** integration check confirmed cross-tenant SELECT denied unless `app.current_role = 'cross_tenant_auditor'`.

## Day 10

- All PBIs in "ready for review" state.
- Compose updated to wire `kms-stub`, `lora-bridge`, `lora-sim`.

## Day 11

- Clean-tree dry run. Stack green within 90 s (eight more containers since Sprint 0; cold-start is now load-bearing for the demo).
- Air-gap drill calendar published to the customer-shared M365 calendar by DevOps On-Prem.

## Day 12

- Demo rehearsal. Procurement framing tightened. PM circulated DIANA pitch deck v2.
- Final security scan: zero Critical, three High in transitive frontend dependencies (no change since Sprint 1).
- All new images Cosign-signed.

## Day 13 — Sprint Review

Audience: PO, PM, Tech Lead, Compliance Officer, CCOSIC SME, Aerostar, STS DevOps liaison, candidate-pilot operator.

| PBI | Result |
|---|---|
| S4-01 | **Accepted.** 100 LoRa points scattered across the layer toggle in Operations view. |
| S4-02 | **Accepted.** Bulk JSON registration round-trip exercised live. |
| S4-03 | **Accepted.** Viewer 403 / Operator 403 (on POST) / Admin 200 demonstrated; Aerostar's tenant-scoped RBAC ask closed. |
| S4-04 | **Accepted.** Idempotent get + rotate verified live. |
| S4-05 | **Accepted.** PASS line shown live. |
| S4-06 | **Accepted.** Brigada Demo loaded with one command; theme + terminology + memberships visible. |

**Aerostar feedback:** "RBAC roles per tenant is exactly what we need to bid the OEM contract. For Sprint 5, can we get a single sign-on hook so our existing IDP feeds X-Will-User without us building anything?" — will-tech-lead notes this as a Sprint 10 NPKI preview path.

**STS DevOps liaison feedback:** "Drill calendar accepted. Add an annual penetration-test entry by end of year."

**SME feedback (CCOSIC):** "Real RAT-31DL test at Cincu confirmed for Sprint 5. The benchmark numbers reassure me you will not surprise me on site."

## Day 14 — Retrospective

Format: Start / Stop / Continue. Three improvement actions for Sprint 5:

1. **Annual penetration-test calendar entry** — DevOps On-Prem + Security Engineer; success measure: entry created in the customer-shared calendar by Sprint 5 Day 3.
2. **Single sign-on shim (OIDC) preview** — Backend Core-2; success measure: design doc + spike committed by Sprint 5 Day 5; full implementation in Sprint 10.
3. **OPA Gatekeeper exempt list per profile** — DevOps Cloud + DevOps On-Prem; success measure: Helm value `policy.exemptImages` parameterised by `deployment_profile` by Sprint 5 review.

---

## Outputs handed to Sprint 5

- 100-node LoRa pipeline live; bulk registration UI live.
- Tenant-scoped RBAC enforced at the API; Members tab live.
- KMS stub interface ready for Sprint 10 Vault swap.
- RLS preview migration applied.
- Brigada Demo loadable in one command.
- Air-gap drill calendar in the customer's planning tool.
- OPA Gatekeeper admission webhook live (dry-run).
- RAT-31DL decoder benchmark recorded; Sprint 5 real-radar test unblocked.
- Three Sprint-5 improvement actions out of the retrospective.
