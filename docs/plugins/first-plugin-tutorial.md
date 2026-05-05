# Write Your First WILL Plugin

> Bilingual document. English first; Romanian below.

---

## English

### What you will build

A working WILL sensor plugin that emits one Track per second to the WILL platform. Total time: roughly **45 minutes** for a developer who has Docker installed.

### Prerequisites

- Docker Engine 24+ and Docker Compose v2.
- A working WILL Romania development environment (see [`docs/setup/dev-environment.md`](../setup/dev-environment.md)).
- Familiarity with one of: Python, Go.

### The contract

Every WILL sensor plugin implements the gRPC service defined in [`will-platform/contracts/proto/will/sensor/v1/sensor.proto`](../../will-platform/contracts/proto/will/sensor/v1/sensor.proto). Four RPCs:

| RPC | Purpose | Cardinality |
|---|---|---|
| `Describe` | Static identity (name, version, contract version, capabilities) | Called once at load |
| `Health` | Liveness and readiness | Polled every 5 s by default |
| `Configure` | Tenant- and runtime-scoped settings; reject unknown keys | Called whenever config changes |
| `Telemetry` | Stream of Track messages | Server-streaming |

### Step 1 — Use the reference plugin as a skeleton

Copy [`will-platform/plugins/reference-echo/`](../../will-platform/plugins/reference-echo/) to a new directory under `will-platform/plugins/<your-plugin-name>/`.

```bash
cp -R will-platform/plugins/reference-echo will-platform/plugins/my-first-plugin
```

### Step 2 — Edit your `Describe`

Change `NAME`, `VERSION`, `VENDOR`, `DESCRIPTION`, and `CAPABILITIES` to describe your plugin. The `CONTRACT_VERSION` constant must remain `v1.0` for Sprint 1; do not change it.

### Step 3 — Implement `Telemetry`

Replace the canned track in `telemetry_track()` with the real reading from your sensor. Mandatory fields:

- `track_id` (UUID v4 per observation)
- `tenant_id` (UUID — passed in via `Configure`)
- `source` (your plugin name plus a per-sensor id, e.g. `"my-first-plugin/sensor-7"`)
- `geometry` — GeoJSON Point in EPSG:4326 (`[longitude, latitude]`)
- `classification` — STANAG 4774 string. Default: `"NESECRET"` (RO national) or `"NATO_UNCLASSIFIED"`. Other accepted values are listed in [`docs/adr/ADR-005-stanag-4774-as-canonical-classification.md`](../adr/ADR-005-stanag-4774-as-canonical-classification.md)
- `observed_at` — RFC 3339 timestamp in UTC

### Step 4 — Validate locally

Build and run your plugin alongside the rest of the stack:

```bash
cd will-platform
docker compose up -d --build
docker compose logs -f my-first-plugin
```

Confirm:

1. Your plugin appears in the Plugin Info panel of the dashboard.
2. Tracks emitted by your plugin appear on the globe.
3. The plugin loader's `/v1/plugins` endpoint returns your plugin in the JSON response.

### Step 5 — Run the conformance kit

The certification kit lands in Sprint 13 with ten automated tests. For Sprint 1 you should at minimum:

- Run `docker compose exec my-first-plugin printenv CONTRACT_VERSION` and confirm `v1.0`.
- Verify your plugin survives a `docker compose restart my-first-plugin` and rejoins the loader without manual intervention.
- Send invalid configuration via the loader API and confirm your plugin rejects unknown keys.

### What is NOT your plugin's responsibility

- **TLS termination.** The loader handles mTLS to the plugin boundary in Sprint 10.
- **Classification banner rendering.** The frontend handles it from your `classification` field.
- **Audit logging.** The platform audits every track end-to-end (Sprint 11).
- **Rate limiting.** The loader applies tenant-scoped quotas (Sprint 4+).

### Common mistakes to avoid

- Hard-coded English-only error messages — strings shown to operators must be localised in i18n.
- Crashing on bad configuration — fail closed, reject the unknown key, return a clear error.
- Emitting tracks without `tenant_id` — the loader will drop them.
- Using `localhost` to refer to other services — use the compose service name (e.g. `emqx`).

### Where to ask for help

- Plugin SDK questions: `#will-plugins` Slack/Mattermost channel; ping `@will-backend-plugins-1` (SDK owner) or `@will-backend-plugins-2` (real-sensor onboarding owner).
- Architecture questions: `@will-tech-lead`.
- Classification or export-control questions: `@will-compliance-officer`.

---

## Română

### Ce veți construi

Un plugin WILL funcțional care emite un Track pe secundă către platforma WILL. Durată totală: aproximativ **45 de minute** pentru un dezvoltator cu Docker instalat.

### Cerințe

- Docker Engine 24+ și Docker Compose v2.
- Un mediu de dezvoltare WILL Romania funcțional (vezi [`docs/setup/dev-environment.md`](../setup/dev-environment.md)).
- Cunoștințe de bază în Python sau Go.

### Contractul

Orice plugin senzor WILL implementează serviciul gRPC definit în [`will-platform/contracts/proto/will/sensor/v1/sensor.proto`](../../will-platform/contracts/proto/will/sensor/v1/sensor.proto). Patru RPC-uri:

| RPC | Scop | Cardinalitate |
|---|---|---|
| `Describe` | Identitate statică (nume, versiune, versiunea contractului, capacități) | Apelat o dată la încărcare |
| `Health` | Stare de funcționare și pregătire | Interogat la fiecare 5 s implicit |
| `Configure` | Setări per chiriaș și per execuție; respinge cheile necunoscute | Apelat la fiecare modificare de configurare |
| `Telemetry` | Flux de mesaje Track | Streaming dinspre server |

### Pasul 1 — Folosiți plugin-ul de referință ca șablon

Copiați [`will-platform/plugins/reference-echo/`](../../will-platform/plugins/reference-echo/) într-un director nou sub `will-platform/plugins/<numele-plugin-ului>/`.

```bash
cp -R will-platform/plugins/reference-echo will-platform/plugins/primul-meu-plugin
```

### Pasul 2 — Editați `Describe`

Schimbați `NAME`, `VERSION`, `VENDOR`, `DESCRIPTION` și `CAPABILITIES` pentru a descrie plugin-ul dumneavoastră. Constanta `CONTRACT_VERSION` trebuie să rămână `v1.0` pentru Sprint 1; nu o modificați.

### Pasul 3 — Implementați `Telemetry`

Înlocuiți track-ul predefinit din `telemetry_track()` cu citirea reală de la senzor. Câmpuri obligatorii:

- `track_id` (UUID v4 pentru fiecare observație)
- `tenant_id` (UUID — primit prin `Configure`)
- `source` (numele plugin-ului plus un identificator de senzor, ex. `"primul-meu-plugin/senzor-7"`)
- `geometry` — Point GeoJSON în EPSG:4326 (`[longitudine, latitudine]`)
- `classification` — șir STANAG 4774. Implicit: `"NESECRET"` (național RO) sau `"NATO_UNCLASSIFIED"`. Alte valori acceptate sunt listate în [`docs/adr/ADR-005-stanag-4774-as-canonical-classification.md`](../adr/ADR-005-stanag-4774-as-canonical-classification.md)
- `observed_at` — marcaj de timp RFC 3339 în UTC

### Pasul 4 — Validare locală

Construiți și rulați plugin-ul alături de restul platformei:

```bash
cd will-platform
docker compose up -d --build
docker compose logs -f primul-meu-plugin
```

Confirmați:

1. Plugin-ul apare în panoul „Plugin-uri” al tabloului de bord.
2. Track-urile emise apar pe glob.
3. Endpoint-ul `/v1/plugins` al loader-ului returnează plugin-ul dumneavoastră.

### Pasul 5 — Rulați kit-ul de conformitate

Kit-ul de certificare ajunge în Sprint 13 cu zece teste automate. Pentru Sprint 1 trebuie să verificați minimum:

- Rulați `docker compose exec primul-meu-plugin printenv CONTRACT_VERSION` și confirmați `v1.0`.
- Verificați că plugin-ul supraviețuiește unui `docker compose restart primul-meu-plugin` și se reînregistrează la loader fără intervenție manuală.
- Trimiteți o configurare invalidă prin API-ul loader-ului și confirmați că plugin-ul respinge cheile necunoscute.

### Ce NU este responsabilitatea plugin-ului

- **Terminarea TLS.** Loader-ul gestionează mTLS la frontiera plugin-ului în Sprint 10.
- **Afișarea banner-ului de clasificare.** Frontend-ul îl gestionează pe baza câmpului `classification`.
- **Jurnalizare audit.** Platforma auditează fiecare track end-to-end (Sprint 11).
- **Limitarea ratei.** Loader-ul aplică cote per chiriaș (Sprint 4+).

### Greșeli frecvente de evitat

- Mesaje de eroare doar în engleză, hardcodate — șirurile afișate operatorilor trebuie localizate.
- Cădere la configurare invalidă — eșuați închis, respingeți cheia necunoscută, returnați eroare clară.
- Emiterea de track-uri fără `tenant_id` — loader-ul le va respinge.
- Folosirea `localhost` pentru a referi alte servicii — folosiți numele serviciului din compose (ex. `emqx`).

### Unde cereți ajutor

- Întrebări despre Plugin SDK: canalul `#will-plugins`; menționați `@will-backend-plugins-1` (responsabil SDK) sau `@will-backend-plugins-2` (responsabil onboarding senzori reali).
- Întrebări de arhitectură: `@will-tech-lead`.
- Întrebări de clasificare sau control export: `@will-compliance-officer`.
