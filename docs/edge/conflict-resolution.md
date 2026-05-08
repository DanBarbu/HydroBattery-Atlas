# Edge Conflict-Resolution Policy

> Sprint 5. Owner: will-edge-engineer. Reviewed by: will-tech-lead, will-fusion-engineer.

## Scope

This document covers the resolution of **command** conflicts between an edge node and the core when an edge has been disconnected and accumulates an outbox. Track-level fusion (multiple sensors observing the same physical object) is the Sprint 6 fusion engine's responsibility and is governed separately.

## Decision

**Last-writer-wins by `observed_at`. Ties are broken by the larger edge-local id (which is monotonic per edge).**

The policy is implemented in `edge/agent/internal/outbox/outbox.go::Resolve` and is exercised by the test suite. The core applies the same rule when more than one edge attempts to issue the same command kind for the same target.

## Rationale

- **Operator-issued commands carry a precise observation timestamp.** When an operator clicks "promote affiliation Hostile" at 12:01:03Z on edge A and another operator clicks the same target at 12:01:07Z on edge B, the network owes the *later* operator the win.
- **Tie-break on edge-local id is deterministic.** Identical timestamps are rare in practice but possible during clock-skew incidents; the local id ensures a deterministic outcome instead of randomness.
- **No CRDT, no consensus.** Sprint 5 deliberately ships the simplest mechanism that works. The Sprint 11 ORNISS file documents the trade-off (no Byzantine guarantees in the current design); Sprint 14+ may revisit with Raft for FMN-conformant deployments.

## Worked examples

### Example 1 — clean late arrival

```
edge A queues @ 12:01:03Z   (edge_local_id=42, kind=promote-affiliation, target=track-7, payload={F})
edge A → partition for 5 min
edge B queues @ 12:01:07Z   (edge_local_id=11, kind=promote-affiliation, target=track-7, payload={H})
edge B → core succeeds      (server records, applies to track-7)
edge A → reconnects, uploads
core resolves: 12:01:07 > 12:01:03 → B wins; A's command is recorded but does not change track-7.
```

### Example 2 — exact tie

```
edge A queues @ 12:01:00.000Z (edge_local_id=42)
edge B queues @ 12:01:00.000Z (edge_local_id=11)
both reconnect within seconds
core resolves on tie: 42 > 11 → A wins.
```

### Example 3 — duplicate replay

```
edge A queues @ 12:01:03Z (edge_local_id=42)
edge A reconnects, uploads, marks sent
edge A loses ack mid-flight; retries the next iteration
core sees (edge_id=A, edge_local_id=42); ON CONFLICT DO NOTHING; idempotent.
```

## Auditability

Every command is persisted by the core in `edge_commands` with `received_at`, `edge_observed_at`, and the edge it came from. The auditor role can run a query that, for any given track + kind, reproduces the resolved outcome from first principles.

## Limitations

- **Clock skew.** If edge clocks drift more than a few seconds, "last-writer-wins" can be wrong with respect to wall-clock truth. Edge nodes run NTP; tactical deployments without NTP must accept the residual risk and document it in their site security plan.
- **No causality tracking.** A command issued *after seeing* the result of another command is not modelled separately; ObservedAt is good enough for Sprint 5 use cases.

## Test coverage

- `edge/agent/internal/outbox/outbox_test.go::TestResolveByTimestamp`
- `edge/agent/internal/outbox/outbox_test.go::TestResolveTieBreaksOnLocalID`
- Integration: the disconnected-demo E2E exercises the full path (queue, partition, reconnect, drain).
