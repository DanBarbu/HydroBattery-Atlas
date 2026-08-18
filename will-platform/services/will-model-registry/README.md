# will-model-registry

Sovereign AI model registry (ADR-020). Stores signed `will.model.v0`
artefacts, enforces classification-ceiling and foreign-origin routing on
read, and holds the load-bearing invariants:

- **empty trust store → admits nothing** (fail-closed);
- **foreign-origin models → OSINT layer only** (ADR-016 / ADR-020);
- **classification above caller ceiling → refused** (fail-closed, same
  primitive as tak-gateway's egress gate);
- **revoked stays revoked** (410 Gone thereafter; irreversible).

Prerequisite for ADR-019 (Delegated Engagement Authority) — any AI in the
DEA loop must be registry-served. ADR-020 explicitly permits scaffolding
this service in parallel with its four-way co-sign cycle because the code
path is fundamentally storage + signing + policy with no kinetic scope.

## Storage layout

```
{DATA_DIR}/{tenant_id}/{model_id}/{version}/
├── card.json      — the will.model.v0 model card
├── artifact.bin   — the raw model bytes
└── signature.bin  — ed25519 signature over (canonical card || artifact)
```

An ORNISS bundle export is a `tar` of the version directory.

## Trust anchors

`TRUST_ANCHORS` points at a JSON file: `{"<signing_key_ref>": "<base64 ed25519 pubkey>", ...}`.
Loaded at startup. Missing file = empty trust store = admission refuses
every card. The KMS/Vault path (ADR-007 successor) plugs in behind the
same `store.LoadTrustAnchors` seam later.

## HTTP API

| Verb | Path | Purpose |
|---|---|---|
| `GET` | `/healthz` | health |
| `POST` | `/v1/tenants/{tenant}/models` | admit — body: `{"card": {...}, "artifact_b64": "...", "signature_b64": "..."}` |
| `GET` | `/v1/tenants/{tenant}/models` | list model_ids for tenant |
| `GET` | `/v1/tenants/{tenant}/models/{model_id}/versions` | list versions |
| `GET` | `/v1/tenants/{tenant}/models/{model_id}/versions/{version}/card` | model card |
| `GET` | `/v1/tenants/{tenant}/models/{model_id}/versions/{version}/artifact` | artefact bytes; requires `?ceiling=X&layer=OPERATIONAL\|OSINT` |
| `POST` | `/v1/tenants/{tenant}/models/{model_id}/versions/{version}/revoke` | irreversible |

Response headers on artefact GET:
- `X-Will-Model-Classification` — the model's own marking
- `X-Will-Model-Origin` — `SOVEREIGN_RO` / `NATO_ALLY` / `FOREIGN` / `OPEN_WEIGHT_FOREIGN_BASE`

## Read-time gate

For every artefact GET, in order (fail-closed):

1. `revocation_state == REVOKED` → **410 Gone**
2. `ceiling` missing or unrecognised → **400 Bad Request**
3. `card.classification` above `ceiling` (or cross-scheme) → **403 Forbidden**
4. `layer` not `OPERATIONAL` or `OSINT` → **400 Bad Request**
5. `card.origin ∈ {FOREIGN, OPEN_WEIGHT_FOREIGN_BASE}` and `layer != OSINT` → **403 Forbidden**

Consumers embed a `registry-client` library call (not yet written) that
attaches its own ceiling and layer per its declared trust tier. Direct
filesystem reads of model files are banned repo-wide by the eventual
`TestNoDirectModelLoad` CI gate (see ADR-020 §Consequences).

## Environment

| Var | Default | Meaning |
|-----|---------|---------|
| `HTTP_ADDR` | `:8093` | listen address |
| `DATA_DIR` | `/var/lib/will/model-registry` | storage root |
| `TRUST_ANCHORS` | `/etc/will/model-registry/trust-anchors.json` | JSON `{key_ref: base64-pubkey}` |

## Governance

ADR-020 is Proposed. This service may run and hold non-HIGH_RISK models
in parallel with the co-sign cycle. **Admission of the first HIGH_RISK
model remains blocked on the Compliance Officer's evaluator identity
chain sign-off** — the API validates `HIGH_RISK` requires
`ai_act_conformity_ref` at the schema level, but the operational meaning
of "conformity ref" is defined by the ADR-020 evaluator process, not by
this service.

## Compose posture

Ships in `docker-compose.yml` with an empty trust store by default — the
service will start and serve `/healthz`, but every admission attempt
returns 400 until a trust-anchors file is mounted. That is the intended
fail-closed dev posture; a real trust store lives outside the compose
tree under the KMS/Vault path.
