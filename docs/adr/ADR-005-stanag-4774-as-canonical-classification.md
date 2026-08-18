# ADR-005 — STANAG 4774 as the canonical classification metadata

- **Status:** Accepted
- **Date:** Sprint 0
- **Decider:** Tech Lead, with Security Engineer and Compliance Officer
- **Consulted:** Backend Core-1, Frontend APP-6D

## Context

Classification metadata is a first-class platform concern, not a UI decoration. Every track, command, and audit event carries a label that drives access control, routing, and operator display. The platform operates under both **Romanian national** classification (Law 182/2002 + HG 585/2002) and **NATO** classification (AC/35 directives); FMN Spiral 4 conformance (Sprint 14) requires interoperable confidentiality labels.

## Decision

We adopt **STANAG 4774 — Confidentiality Metadata Label Syntax** as the canonical metadata format across the platform. We carry a Romanian-national equivalent label alongside (mapped per the equivalence table in the work plan §4.5). On the wire and at rest the labels are STANAG 4774; the UI renders both the NATO and the RO marking where they differ.

**STANAG 4778 — Metadata Binding Mechanism** lands in Sprint 9, providing the cryptographic binding of label to data. Until then, the column exists, the values are validated, and the contract is in place — but the binding is logical, not yet cryptographic.

## Alternatives considered

- **Custom string column.** Rejected — incompatible with FMN; precludes external tooling.
- **NATO marking only.** Rejected — leaves Romanian operators without their statutory marking; violates Law 182/2002 obligations.
- **Romanian marking only.** Rejected — breaks NATO interoperability and FMN conformance.
- **Defer the decision until Sprint 9.** Rejected — retrofitting classification into a mature schema is the well-known nightmare we explicitly avoid.

## Consequences

- The `tracks` schema (V0001) carries a `classification` column with both Romanian and NATO accepted values.
- The frontend renders a classification banner from Sprint 0; Sprint 9 elevates it from a static unclassified default to a per-record dynamic banner with crypto binding.
- Plugin authors must label their telemetry; the SDK validates label values at the contract edge from Sprint 1.
- The Compliance Officer reviews any change to the classification column or its accepted values.
