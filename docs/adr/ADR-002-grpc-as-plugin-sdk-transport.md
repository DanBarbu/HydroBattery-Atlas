# ADR-002 — gRPC as the Plugin SDK transport

- **Status:** Accepted
- **Date:** Sprint 0
- **Decider:** Tech Lead, with Squad Bravo
- **Consulted:** Product Owner, Security Engineer

## Context

The Plugin SDK is the WILL crown jewel. Sensors, effectors, AI modules, and TDL adapters all integrate as plugins. The transport must support strongly typed contracts, streaming telemetry, multiple host languages, mutual TLS, and a believable backwards-compatibility story over a 3+ year window.

## Decision

The Plugin SDK uses **gRPC** as the canonical transport. Contracts live in a versioned `contracts/` repository as `.proto` files. Generated stubs ship for Go and Python in Sprint 1, with C++ and Rust added when a customer plugin demands them. mTLS terminates at the plugin boundary; certificate issuance integrates with Vault (Sprint 10) and NPKI (Sprint 10) on classified deployments.

Streaming RPCs carry telemetry; unary RPCs carry control. Unsolicited high-rate publication is bridged onto the EMQX bus by the loader, not by the plugin directly, so plugins remain transport-agnostic at their edge.

## Alternatives considered

- **REST/JSON.** Rejected — weak typing, weaker contract testing, awkward streaming.
- **MQTT-only.** Rejected — message bus is the wrong place for control-plane RPCs and lifecycle.
- **Cap'n Proto / FlatBuffers.** Rejected — smaller community, weaker tooling for the languages we expect plugin authors to use.
- **WebSocket + JSON-RPC.** Rejected — no canonical contract definition; weaker codegen story.

## Consequences

- We commit to maintaining `contracts/` as a public artefact with semantic versioning.
- We must build conformance tests that exercise contract evolution: a Sprint-1 plugin must continue to load against the Sprint-15 core.
- The OPA Gatekeeper policy at deploy time rejects any plugin whose declared contract version is unknown to the cluster.
- Plugin authors get language-specific quickstarts (Tech Writer owns these from Sprint 1).
