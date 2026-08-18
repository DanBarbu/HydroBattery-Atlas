# ADR-001 — Adopt Mythic (forked) as the C2 core

- **Status:** Accepted
- **Date:** Sprint 0
- **Decider:** Tech Lead, with Squad Alpha
- **Consulted:** Product Owner, Security Engineer, Compliance Officer

## Context

The WILL platform needs a containerised, multi-user C2 core with a usable web UI, a message bus, and a database. Building one from scratch wastes the first six sprints. The candidate stack must be modifiable (we will rebrand and strip features), scriptable (operators must be able to author tasking), and acceptable to a defence customer once stripped and accredited.

## Decision

Fork the open-source Mythic framework and use it as the WILL C2 core, branded **WILL Core**. We strip all red-team / offensive modules in the fork; we keep the orchestrator, the agent comms substrate, the multi-user model, and the operator UI.

For Sprint 0, the production fork is not ready. We ship a small **WILL Core stub** (`will-platform/docker/will-core-stub/`) that exposes `/healthz` and `/version` so the rest of the stack can integrate against the contracted endpoints. The full fork lands in Sprint 1+.

## Alternatives considered

- **Build from scratch.** Rejected — burns Sprint 0–5 on plumbing the customer never sees.
- **Use Velociraptor or another DFIR-oriented framework.** Rejected — investigative model does not match a tactical C2 picture.
- **Use a commercial C2 core (closed-source).** Rejected — defeats the open-core sovereignty story and complicates ORNISS accreditation.

## Consequences

- The fork inherits Mythic's Docker / RabbitMQ / PostgreSQL / React stack. We adopt that as the baseline and align Sprint 0 services with it.
- We accept a one-time integration cost in Sprint 1 to cut over from the stub to the fork.
- The legal / licensing register tracks the fork as a derived work; the License Officer reviews this quarterly.
- The fork lives in our internal GitLab and never depends on a public registry for production builds (air-gap profile).
