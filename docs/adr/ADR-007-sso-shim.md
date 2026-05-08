# ADR-007 — SSO Shim (OIDC) ahead of NPKI

- **Status:** Accepted
- **Date:** Sprint 5 (Sprint 4 retrospective action #2; raised by Aerostar at the Sprint 4 review)
- **Decider:** Tech Lead, with Backend Core-2 and Security Engineer
- **Consulted:** Compliance Officer, DevOps Cloud, DevOps On-Prem

## Context

Sprint 4 ships RBAC enforcement via the `X-Will-Role` header. NPKI / smart-card binding lands in Sprint 10. Aerostar (industry partner) asked at the Sprint 4 review: "Can we get a single sign-on hook so our existing IDP (Keycloak) feeds `X-Will-User` without us building anything?" This makes Aerostar an effective dogfooder for the OEM story months before NPKI is ready.

We do not want to ship a temporary auth path that creates a maintenance liability for the NPKI work. We do want a clean sidecar that Aerostar can drop into their cluster.

## Decision

Adopt **OIDC** as the SSO shim transport. The shim is a small reverse proxy in front of the WILL admin and operator surfaces.

- The shim authenticates the user against the customer's OIDC IDP (Keycloak / Microsoft Entra / RO national federation).
- On a valid login it sets `X-Will-User` and `X-Will-Role` upstream, derived from group claims (`groups: ["will-admin"]` → `admin`, etc.).
- A small Helm chart (`helm/charts/will-sso-shim`) ships in Sprint 5 in **preview** state. The shim is opt-in per deployment profile.
- Sprint 10 NPKI replaces the OIDC shim path on the on-prem and CPG profiles. The cloud profile keeps the OIDC option for partner OEMs.

## Alternatives considered

- **SAML.** Rejected for Sprint 5 — heavier metadata exchange; partners we have spoken to default to OIDC.
- **Build the auth into tenant-admin and plugin-loader directly.** Rejected — couples Sprint 5 to the auth path; we want the auth path swappable for NPKI without rebuilding the services.
- **Wait for NPKI (Sprint 10).** Rejected — Aerostar pilot interest stalls; the OEM story loses momentum.

## Consequences

- A new component (the shim) is added to the deployment graph. ADR-004 (Helm + Terraform) covers its packaging.
- The shim is the **only** component that talks OIDC. Tenant-admin and plugin-loader keep the simple `X-Will-Role` interface; Sprint 10 swaps the shim for the NPKI binder without touching them.
- The Sprint 4 RBAC role catalogue (ADR n/a — discussed in Sprint 4 docs) remains the source of truth for what each role may do.
- The shim's mapping from IDP claims to WILL roles is a per-tenant configuration item, surfaced in tenant-admin in Sprint 6.

## Sprint 5 deliverable scope

Sprint 5 ships a **design skeleton**: ADR-007 (this document), a `services/tenant-admin/internal/auth` package interface, and a Helm chart placeholder. The Sprint 5 sprint plan does NOT promise a working OIDC binding — that is Sprint 6 work and is committed in the Sprint 5 procurement overlay as a follow-up.
