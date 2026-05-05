# Air-Gap Mirror Procedure for New WILL Images

> Sprint 2 retrospective action #3. Owner: DevOps On-Prem. Reviewed by: Security Engineer, Compliance Officer.
> This procedure governs how every new container image, Helm chart, Terraform provider, and binary artefact crosses the air-gap into the CPG/STS and on-premises classified deployment profiles.

---

## 1. Scope

Applies to all artefacts under `will-platform/` and `docs/adr/` whenever a new image, chart, or binary needs to reach a classified deployment. Does **not** apply to the EU Sovereign Cloud profile (online build chain).

## 2. Roles

| Role | Responsibility |
|---|---|
| DevOps On-Prem | Owns the procedure end-to-end. Runs the cross-domain transfer. Maintains the artefact ledger. |
| Security Engineer | Verifies signatures and the SBOM before the transfer. Approves the artefact bundle. |
| Compliance Officer | Confirms classification of every artefact and the right-to-export per EU Reg. 2021/821 and Romanian classified-info law. |
| ORNISS POC at the customer site | Receives the bundle on the classified side; physically witnesses ingestion. |

## 3. Pre-flight (online side)

1. Tag the release on the GitLab build server: `vYYYY.MM.DD.<n>` (RFC-3339 date plus a per-day counter).
2. CI runs the full pipeline (lint → test → build → scan → sign → canary). Pipeline must be green; a failed canary blocks the bundle.
3. Generate a SBOM (CycloneDX) for every container image. Store under `dist/sboms/`.
4. Run `cosign verify` against every image and capture the JSON output. Store under `dist/sigs/`.
5. Snapshot the Helm chart and any new Terraform providers with their checksums. Store under `dist/helm/` and `dist/terraform/`.
6. Run the licence register check (`will-platform/contracts/README.md` references; `docs/programme/licence-register.md`). Compliance Officer signs off in writing.

## 4. Bundle structure

Every air-gap bundle is a single signed `.tar.zst` archive named `will-airgap-<tag>.tar.zst` containing:

```
will-airgap-<tag>/
├── manifest.json         # SHA-256 of every file plus their classifications
├── images/               # OCI image tarballs (`docker save`)
├── sboms/                # one CycloneDX per image
├── sigs/                 # cosign verification outputs
├── helm/                 # WILL Helm chart + values for the target profile
├── terraform/            # provider tarballs and state-import plans
├── docs/                 # release notes, ADRs touched, runbook deltas
└── checksum.txt          # SHA-256 of every file, signed
```

`manifest.json` carries:
- `version` of the bundle format (currently `1`)
- `tag` of the WILL release
- `created_at` (RFC 3339 UTC)
- per-file `path`, `sha256`, `classification` (per HG 585/2002 and STANAG 4774 marking)
- `signed_by` (Security Engineer's eIDAS-2 qualified signature)

## 5. Transfer

1. The bundle is written to a **single-use, write-once optical medium** (BD-R, AES-256 archive password held by ORNISS POC) or to a customer-supplied air-gap appliance.
2. Two-person rule: DevOps On-Prem and the Security Engineer must both be present at the write step.
3. The empty packaging and the medium are walked across the air-gap by the DevOps On-Prem engineer; the customer's ORNISS POC witnesses the ingestion.
4. After ingestion, the medium is immediately destroyed per ORNISS procedure (single-use rule).

## 6. Ingestion (classified side)

1. The customer's ORNISS POC verifies the medium's seal and the printed checksum against the bundle's `checksum.txt`.
2. Run `cosign verify` against the on-prem trusted public key (rotated quarterly; held in HSM). Any signature mismatch aborts ingestion; the bundle is destroyed and a fresh one is rebuilt.
3. Load images into the local OCI registry: `for img in images/*.tar; do skopeo copy oci-archive:$img docker://registry.classified.local/$(basename "$img" .tar); done`.
4. Promote the Helm chart to the in-cluster repository.
5. Update the local **artefact ledger** (`/var/lib/will/airgap-ledger.csv`) with: tag, ingestion date, ORNISS POC signature, on-prem operator signature, classification.
6. Run the smoke-test job (`helm test will`) before any production rollout.

## 7. Backout

If a bundle ingests but a smoke-test fails, the previous tag is re-promoted via `helm rollback`. The failed bundle's images are quarantined in a separate registry namespace and not deleted until root-cause is documented.

## 8. Audit trail

Every bundle ingestion writes a row to the artefact ledger. The ledger is exported quarterly (eIDAS-2 signed) to the customer's INFOSEC office and to the WILL Compliance Officer for the Sprint 11 ORNISS pre-accreditation file.

## 9. Frequency and SLA

- Routine release cadence: per WILL minor release (every two sprints), or as needed for security fixes.
- Security-fix SLA: bundle prepared and ready to transfer within **72 hours** of a confirmed High or Critical CVE in the production set (work-plan §15 R-09 / §15 R-10 alignment).
- Drill cadence: a dry-run ingestion on a non-production cluster every quarter; documented in the runbook.

## 10. Pre-checklist (one-page)

- [ ] CI pipeline green (incl. canary)
- [ ] All images Cosign-signed and SBOMs generated
- [ ] Compliance Officer dual-use export-control check passed
- [ ] Bundle built and `manifest.json` signed by Security Engineer
- [ ] Two-person write step scheduled
- [ ] ORNISS POC notified ≥ 24 h in advance
- [ ] Backout plan reviewed
- [ ] Artefact ledger ready to receive a new row
