# tak-gateway

Bidirectional, classification-gated bridge between WILL and a **customer-operated**
TAK Server. See [ADR-017](../../docs/adr/ADR-017-tak-server-integration.md).

WILL **wraps, does not own**: it connects to the customer's TAK Server as an
enrolled streaming client. It does not bundle, fork, host, or redistribute TAK
Server or ATAK-CIV, and never touches the restricted ATAK-MIL/GOV tiers.

## Two gates before any TAK socket opens

The gateway always serves `/healthz` and the decision API, but it will **not**
open a connection to a TAK Server unless **both** gates pass:

1. **Install/first-run opt-out decision** (`internal/decision`). On a fresh
   install the state is `pending` — nothing connects. An operator records an
   explicit choice:

   ```
   curl -X POST localhost:8092/decision \
     -d '{"decision":"enabled","operator":"cpt.ionescu","reason":"BR2VM TAK federation"}'
   # or to decline TAK integration entirely (sticky):
   curl -X POST localhost:8092/decision -d '{"decision":"opted_out","operator":"..."}'
   ```

   The decision, who made it, and when, are persisted (`TAK_DECISION_FILE`).
   An unattended install may seed a default via `TAK_DECISION=opted_out`, but a
   seed never overrides an operator's existing choice.

2. **ADR-017 co-sign acknowledgement** (`TAK_COSIGN_ACK=true`). ADR-017 is
   *Proposed*; production use requires Tech Lead + Compliance + Security sign-off.
   Until then this stays `false` and the bridge will not run even if enabled.

## Direction & the classification gate

- **Ingress** (TAK → WILL): inbound CoT becomes `will.track.v0` on
  `MQTT_INGRESS_TOPIC`. TAK is a **sensor source**, never authoritative.
- **Egress** (WILL → TAK): each WILL track passes `internal/egress` — a
  **fail-closed** filter. A track egresses only if its STANAG-4774 marking is
  at or below `EGRESS_CEILING`. Above-ceiling, unmarked, malformed, or
  cross-scheme markings are **dropped, never downgraded**. OSINT tracks egress
  only when `EGRESS_ALLOW_OSINT=true`. Conformance:
  `internal/egress.TestEgressNeverExceedsCeiling`.
- **No tasking**: there is no command/tasking path to TAK clients.

## Transport

CoT XML over **TCP/TLS with mutual-cert auth**. TLS verification is mandatory
(no insecure-skip). TAK Protocol v1 (protobuf) and Federation Hub federate
topology are declared follow-ups (ADR-017a).

## Key environment variables

| Var | Default | Meaning |
|-----|---------|---------|
| `HTTP_ADDR` | `:8092` | status + decision API |
| `TAK_DECISION_FILE` | `/var/lib/will/tak-gateway/decision.json` | persisted decision |
| `TAK_DECISION` | (unset) | unattended seed (`enabled`/`opted_out`), fresh install only |
| `TAK_COSIGN_ACK` | `false` | governance gate; set `true` only after ADR-017 sign-off |
| `TAK_SERVER_ADDR` | (unset) | `host:port` of the TAK Server CoT-TLS port |
| `TAK_TLS_CERT` / `TAK_TLS_KEY` / `TAK_TLS_CA` | `/etc/will/tls/...` | mTLS material (mounted, never committed) |
| `INGRESS_CLASSIFICATION` | `NESECRET` | marking applied to inbound TAK tracks |
| `MQTT_URL` | `tcp://emqx:1883` | bus |
| `MQTT_INGRESS_TOPIC` | `telemetry/tak/ingress` | inbound track topic |
| `EGRESS_ENABLED` | `false` | opt-in egress |
| `EGRESS_SUBSCRIBE_TOPIC` | `telemetry/#` | tracks considered for egress (tak-sourced skipped) |
| `EGRESS_CEILING` | `NESECRET` | federation accreditation ceiling |
| `EGRESS_ALLOW_OSINT` | `false` | allow OSINT tracks to egress |
