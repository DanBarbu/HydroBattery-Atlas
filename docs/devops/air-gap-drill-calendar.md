# Air-Gap Drill Calendar

> Sprint 3 retrospective action #1. Owner: DevOps On-Prem.
> Companion to `air-gap-mirror-procedure.md`. The procedure is the runbook; this calendar is the cadence.

## Purpose

A documented air-gap mirror procedure is only credible if it is rehearsed on a regular cadence. The Romanian customer's INFOSEC office (and ORNISS during pre-accreditation) explicitly looks for evidence of drills, not just a written procedure. This calendar makes the drill cadence a programme-level commitment.

## Cadence

| Cadence | Activity | Participants |
|---|---|---|
| **Quarterly (4×/year)** | Full dry-run drill of the air-gap mirror procedure on a non-production cluster. End-to-end: bundle build → write step → ingestion → smoke test → ledger row → backout test. | DevOps On-Prem (lead), Security Engineer, Compliance Officer, customer ORNISS POC, customer INFOSEC observer (optional but invited). |
| **Per WILL minor release** | Real ingestion against the staging classified cluster. Two-person rule honoured. Ledger row written. | DevOps On-Prem, Security Engineer. |
| **Within 72 h of a confirmed High/Critical CVE** | Out-of-band security-fix bundle prepared, transferred, and ingested. | DevOps On-Prem, Security Engineer, customer ORNISS POC (on call). |
| **Annually** | Drill of the **backout** path: ingest a deliberately broken bundle, watch the smoke test fail, run `helm rollback`, document. | All quarterly participants plus Tech Lead. |

## 2026 calendar (illustrative, locked at programme kick-off)

| Date (planned) | Drill type | Lead |
|---|---|---|
| 2026-W12 (March) | Q1 quarterly | DevOps On-Prem |
| 2026-W24 (June)  | Q2 quarterly + annual backout drill | DevOps On-Prem + Tech Lead |
| 2026-W37 (September) | Q3 quarterly | DevOps On-Prem |
| 2026-W49 (December) | Q4 quarterly | DevOps On-Prem |
| Per release | Tied to Sprint 5/7/9/11/13/15 release tags | DevOps On-Prem |

The customer-shared planning tool (M365 calendar in the `INFOSEC-WILL` shared mailbox) carries these dates as recurring events. DevOps On-Prem owns reschedules and re-issues the meeting invitations within seven calendar days of any postponement.

## Roles for each drill

| Role | Pre-drill | During | Post-drill |
|---|---|---|---|
| DevOps On-Prem | Owns the drill. Builds bundle. Walks procedure. | Leads two-person write step. | Files a drill report (template below). |
| Security Engineer | Reviews bundle. Verifies signatures. | Witnesses write step; runs `cosign verify` on classified side. | Co-signs the drill report. |
| Compliance Officer | Confirms classification of every artefact. | Observes ingestion; checks ledger row. | Updates the Sprint 11 ORNISS pre-accreditation file. |
| Customer ORNISS POC | Confirms availability ≥ 24 h ahead. | Witnesses physical-medium handover. | Co-signs the ledger row. |
| Customer INFOSEC observer | Optional invitation. | Observation-only role; may ask any question. | Provides written feedback within five working days. |

## Drill-report template

Every quarterly drill produces a one-page report committed to `docs/devops/drill-reports/YYYY-Qn.md` with the following sections:

1. **Date, location, participants** (who, signed by each).
2. **Bundle metadata** (tag, image count, SBOM count, total size, classification).
3. **Steps executed and any deviations** from the procedure.
4. **Findings** (P0/P1/P2/P3) with owner, deadline, fix evidence.
5. **Backout test outcome** (annual only).
6. **Recommendation** for the next drill or for the procedure itself.

## Failure modes and consequences

- **Drill skipped without rescheduling** → Programme Manager raises a programme-level risk. Two consecutive skips trigger a steering-committee escalation.
- **Drill fails with a P0** → next minor release is paused until the P0 is fixed and a follow-up drill confirms the fix. Sprint plan absorbs the slip; will-programme-manager updates the cohort-cycle calendar accordingly.
- **Customer ORNISS POC unavailable for ≥ 6 weeks** → the Compliance Officer plays the POC role for one drill maximum; the second consecutive substitution is flagged to the customer's INFOSEC office in writing.

## Auditability

The drill calendar, the meeting invitations, the drill reports, and the ledger rows together constitute the air-gap evidence pack for the Sprint 11 ORNISS pre-accreditation submission. The Compliance Officer maintains the index.
