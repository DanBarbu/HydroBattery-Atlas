# ADR-020 — Sovereign AI Model Registry

- Status: Proposed
- Date: (concurrent with ADR-019 draft; prerequisite for its first gateway)
- **Co-sign required before Accepted:** Tech Lead · Compliance Officer · Security Engineer · Product Owner
- Consulted: Fusion Engineer, both Scrum Masters, DevOps (on-prem), Edge Engineer

## Context

WILL runs machine-learning models today, dispersed across the platform:

- `will-fusion-engineer` operates a track-prediction model (advisory,
  currently ONNX baked into the fusion container image);
- Plugin-side classifiers exist in prototype form (APP-6D
  affiliation-hint from EO imagery, hostile-UAS class hint in
  `merops-osint`, anomaly hint in the AIS layer);
- Future plugins under ADR-018 will grow additional classifiers as the
  Rheinmetall / Quantum / MEROPS real feeds land.

None of these have provenance discipline, none are signed, none are
versioned as first-class artefacts, none carry a classification label
that travels with the model, and none are air-gap-deliverable in a form
ORNISS can accredit. They are containerised binaries whose training
dataset, evaluator, and hyperparameters are lost the moment the
container is rebuilt.

Two independent forces make this unsustainable:

1. **ADR-019 (Delegated Engagement Authority).** Any AI whose output can
   affect a target-class match, a fusion-confidence threshold, or a
   weapons_state gate inside an active envelope must be
   registry-served, signed, and classification-labelled — otherwise the
   DEA audit trail is uninterpretable and the EU AI Act conformity file
   is undefendable.
2. **The sovereign-AI industrial narrative** (Balog SAFE analysis;
   commenter's "Gigafabrică de IA la Marea Neagră" proposal). Romania
   is on a policy trajectory toward sovereign AI production. WILL is
   the natural deployment vehicle for such a facility's output. It
   needs a registry that can accept Romanian-signed models, refuse
   foreign models in operational paths, and route them to the OSINT
   layer only (ADR-016 discipline) where operational trust would be
   inappropriate.

The current state — models as opaque container binaries — cannot serve
either force.

## Decision

Introduce a **sovereign AI model registry** as a first-class WILL
service (`services/will-model-registry`), backed by a signed model
manifest, an artefact store, and a strict consumer discipline.

### Model artefacts are signed, versioned, classification-labelled

Every model deployed to WILL is a `will.model.v0` artefact. A model
card MUST accompany it:

| Field | Meaning |
|---|---|
| `model_id` | UUID; stable across versions |
| `version` | semver; monotonic per `model_id` |
| `purpose` | codified purpose from a controlled vocabulary (e.g. `TRACK_PREDICTION`, `HOSTILE_UAS_CLASSIFY`, `AIS_ANOMALY`, `APP6D_AFFILIATION_HINT`) |
| `format` | `ONNX` / `GGUF` / `TFLITE` / `TORCHSCRIPT` |
| `classification` | STANAG-4774 marking that travels with the model |
| `origin` | `SOVEREIGN_RO` / `NATO_ALLY` / `FOREIGN` / `OPEN_WEIGHT_FOREIGN_BASE` |
| `training_dataset_ref` | opaque id + hash; references the (future) sovereign data registry — a model whose dataset cannot be identified cannot be deployed operationally |
| `evaluator` | signed identity of the accreditor; must be RO-accredited for `SOVEREIGN_RO` origin |
| `hyperparameters_hash` | cryptographic hash over the training config; reproducibility anchor |
| `signing_key_ref` | KMS/Vault key id (ADR-007 successor); signature over the artefact + card |
| `ai_act_risk_class` | `MINIMAL` / `LIMITED` / `HIGH_RISK`; the last requires a conformity file link |
| `ai_act_conformity_ref` | URI/id of the conformity assessment record (only required if `ai_act_risk_class = HIGH_RISK`) |
| `orniss_accreditation_ref` | required for deployment above `NESECRET` |
| `revocation_state` | `ACTIVE` / `DEPRECATED` / `REVOKED`; revoked models MUST refuse to load |
| `consumers` | list of services/plugins declared to consume this model; verified at deploy time |

The artefact + card + signature is the atomic unit. There is no valid
model without a valid card and a valid signature.

### Consumers load models via the registry, not from disk paths

Every service and plugin that runs ML uses a `registry-client` library
call: `registry.Load(purpose, tenant, classification_ceiling)`. The
library:

- verifies the artefact signature against the trust store,
- refuses `REVOKED` models,
- refuses models whose `classification` exceeds the `classification_ceiling` passed by the caller (fail-closed, same primitive as ADR-017 egress gate),
- refuses `FOREIGN` origin outside the OSINT layer (ADR-016 rule
  encoded in code),
- records a load event in the audit ledger (`will.model.event.v0`).

Direct `os.Open("/models/foo.onnx")` in application code is banned;
`TestNoDirectModelLoad` scans the codebase for filesystem model reads
and fails CI on any hit outside the registry client.

### Foreign models: OSINT layer only

`origin ∈ {FOREIGN, OPEN_WEIGHT_FOREIGN_BASE}` models MAY be loaded
only by services on the OSINT topic family (`telemetry/osint/*`), and
their outputs inherit the OSINT caveat (per ADR-016). A `FOREIGN` model
cannot serve `will-fusion-engineer` operational track prediction, cannot
gate a DEA envelope, and cannot feed a plugin's operational
`will.track.v0` output. This is enforced by the registry client, not by
policy alone.

The `OPEN_WEIGHT_FOREIGN_BASE` distinction exists for the realistic case
where a Romanian team fine-tunes a foreign open-weight base model
(e.g. an open-weight LLM or vision backbone). The result is treated as
FOREIGN for load-path purposes unless a formal re-accreditation is
recorded (a separate model card with `origin = SOVEREIGN_RO` and a
conformity file that assesses the base + fine-tune as a whole).

### Deprecation and revocation are first-class

- **Deprecation** is a soft signal: consumers see a warning, the model
  still loads. Used for orderly migration.
- **Revocation** is hard: consumers refuse to load; already-loaded
  instances receive a revocation event and unload within one bus
  round-trip. Used for security failures (compromised signing key,
  discovered training-data leak, discovered evasion vulnerability).

A revocation event is signed, audited, and irreversible in the ledger
(re-instatement requires a new model version with a new card).

### The registry is tenant-scoped

Every model deployment binds to a tenant (ADR-006). A model deployed in
tenant A is invisible to tenant B unless explicitly cross-published
with a fresh card and signature. This preserves the multi-tenant
compartment discipline for AI as strictly as for data.

### Air-gap delivery is a first-class shape

The registry supports an **ORNISS bundle** export format: a signed
tarball containing artefact, card, dependencies (tokeniser, class
mapping, etc.), evaluator's public key chain, and provenance ledger
excerpt covering the model's lifecycle to date. This is the artefact
handed across an air-gap boundary between the sovereign training
facility and an on-prem WILL deployment. Import verifies the bundle end
to end before any consumer may load the model.

## Out of scope

- **Training itself.** The training facility (Balog / commenter's
  "Gigafabrică") is separate infrastructure. WILL consumes registry
  entries; it does not train. Training pipelines, GPU clusters, and
  dataset curation live outside WILL's boundary.
- **Model evaluation methodology.** The registry stores an evaluator's
  attestation; it does not itself run evaluation harnesses. Evaluation
  discipline lives with the training facility and the AI-Act
  conformity assessor.
- **Foreign models in operational paths.** Deliberate — see OSINT
  restriction above.

## Cross-cutting

1. **EU AI Act.** Each `HIGH_RISK` card carries a conformity file
   reference; the registry's admission control refuses to admit a
   `HIGH_RISK` model whose reference is missing or dangling. This is
   the machine-checked back-end of `will-compliance-officer`'s
   process.
2. **ORNISS + AC/35.** Above-NESECRET deployment requires
   `orniss_accreditation_ref`. Air-gap import verifies chain.
3. **STANAG-4774 / 4778.** Model classification travels with the
   artefact (4774); artefact + card is 4778-bound.
4. **ADR-007 successor (Vault/HSM).** Signing keys and per-tenant
   verification keys are held in Vault; signature verification uses HSM
   attestation where the deployment provides one.
5. **ADR-019 dependency.** ADR-019 explicitly refuses to admit any AI
   in the DEA loop that is not registry-served under this ADR. ADR-020
   is a hard prerequisite for the first DEA authorisation gateway.
6. **ADR-016 dependency.** The `FOREIGN` model → OSINT-only rule is a
   code-level restatement of the ADR-016 discipline for AI.
7. **Plugin migration.** All ADR-018 plugins that use ML (skynex,
   skyranger, vector, lynx, mmpv90, merops-osint) migrate their
   classifier loads to the registry client. The migration is
   backwards-compatible: a plugin without a registry client still runs
   with a compile-time-baked model, but a lint gate rejects any *new*
   plugin that does so.

## Alternatives considered

- *Continue with models baked into container images.* Rejected —
  provenance lost, no revocation surface, no AI-Act conformity link,
  cannot serve DEA.
- *Use an off-the-shelf model registry (MLflow, HuggingFace private
  hub, etc.).* Rejected — foreign-hosted / foreign-dependency
  registries cannot serve as the sovereign trust anchor for RO MoD
  accreditation. A registry is precisely the wrong place to accept a
  supply-chain dependency.
- *Pass foreign models through with a warning banner instead of routing
  them to OSINT-only.* Rejected — banners are ignored under load; the
  code-level restriction is the only defensible boundary.
- *Skip revocation semantics; treat compromised models as a full
  redeploy problem.* Rejected — a compromised model in an operational
  fusion path is an incident. Revocation must be a first-class
  primitive that unloads consumers in bounded time.
- *Model card as JSON only, unsigned.* Rejected — the whole point is
  the signature. Card + artefact + signature is atomic.

## Consequences

- New service: `services/will-model-registry` (admission API, storage,
  card store, revocation, event emitter, ORNISS-bundle export/import).
- New schema: `will.model.v0` (card), `will.model.event.v0`
  (load/deprecate/revoke).
- New client library: `internal/model-registry-client` (Go); reused by
  every service and plugin that runs ML.
- New tests: `TestNoDirectModelLoad` (CI scan for filesystem reads of
  `*.onnx` / `*.gguf` / `*.tflite` / `*.pt` outside the registry
  client); `TestForeignModelRefusedInOperationalPath`;
  `TestClassificationCeilingHonoured`; `TestRevocationUnloadsWithinBusRoundTrip`.
- Migration work: `will-fusion-engineer`'s track-prediction model
  becomes the first registry entry (as a `SOVEREIGN_RO` or
  `NATO_ALLY` entry depending on its actual provenance — worth an
  honest audit before migration).
- ADR-016 plugins that use classifiers (merops-osint, adsb-osint if
  ever) declare their `origin` and route through the registry.
- ORNISS bundle format specified as part of this ADR; consumed by
  `will-devops-onprem`.
- Signing-key custody defined against Vault (ADR-007 successor).

## Status

**Proposed.** Implementation of the registry service and the migration
of the first (fusion track-prediction) model may begin in parallel with
the co-sign cycle, because ADR-020 is a technical-and-compliance
artefact rather than a doctrinal one, and it is a hard prerequisite for
ADR-019. The four co-signs required before Accepted:

- Tech Lead — schema shape, client library, `TestNoDirectModelLoad`
  gate
- Compliance Officer — EU AI Act conformity linkage, ORNISS bundle
  spec, foreign-origin discipline
- Security Engineer — signing/verification chain, key custody,
  revocation semantics
- Product Owner — cross-tenant publishing rules, deprecation UX,
  migration order for existing models

No `SOVEREIGN_RO` model may be admitted to the registry before the
evaluator identity chain (Compliance + Security co-sign) is
operational. Foreign-origin OSINT models may be admitted earlier as
they are strictly scoped and pose lower accreditation risk.
