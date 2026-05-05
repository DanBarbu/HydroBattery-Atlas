# ADR-004 — Helm + Terraform as the deployment toolchain

- **Status:** Accepted
- **Date:** Sprint 0
- **Decider:** Tech Lead, with DevOps Cloud and DevOps On-Prem
- **Consulted:** Security Engineer, Programme Manager

## Context

WILL ships into three deployment profiles that must share one chart and one provisioning toolchain:

1. **EU Sovereign Cloud** (OCI EU regions Madrid / Frankfurt) — for unclassified and NATO RESTRICTED tenants.
2. **Government Private Cloud** (CPG / STS) — for Romanian Secret de Serviciu and Secret tenants.
3. **On-prem air-gapped** — for NATO SECRET deployments and tactical edge.

All three require code-driven, reviewable, reversible provisioning.

## Decision

- **Terraform** (with OCI Resource Manager on the cloud profile) provisions all infrastructure: VCNs/networking, IAM, Vault, OKE / K3s clusters, databases.
- **Helm 3** packages every WILL service. A single chart parameterises the three profiles via a `deployment_profile` value.
- **Ansible** is permitted only for bare-metal bootstrap (BIOS, secure-boot, FDE) on the on-prem profile; everything above the OS is Terraform + Helm.
- **GitLab CI** (self-hosted on STS for classified work) drives the pipeline. **OCI DevOps** is acceptable on the cloud profile but we never depend on it exclusively.

## Alternatives considered

- **Kustomize-only.** Rejected — Helm's release lifecycle and chart distribution outweigh Kustomize's simplicity for a multi-service multi-profile platform.
- **Pulumi.** Rejected — smaller in-house knowledge base; Terraform mindshare in defence integrators is materially stronger.
- **Custom shell-based deployment scripts.** Rejected — opaque, unauditable, hostile to ORNISS reviewers.

## Consequences

- The Helm chart is reviewed cross-profile every sprint; drift between profiles is a P1.
- Terraform state lives in OCI Object Storage (cloud profile) and on STS-managed storage (CPG / on-prem); state is never in a public bucket.
- All Terraform plans are reviewed by the Security Engineer before apply.
- Both DevOps engineers cross-pair monthly to keep profile parity.
