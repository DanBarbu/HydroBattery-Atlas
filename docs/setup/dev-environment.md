# WILL Romania — Development Environment

> Bilingual document. English first, Romanian below.

---

## English

### Prerequisites

- Docker Engine 24+ and Docker Compose v2.
- 16 GB RAM, 4 vCPU minimum on the developer workstation.
- A Cesium Ion access token for higher-quality imagery (optional in Sprint 0; the dashboard works against the default imagery without one).

### First-time bring-up

```bash
cd will-platform
cp .env.example .env
# (optionally edit .env to set VITE_CESIUM_ION_TOKEN)
docker compose up -d
```

All containers should report healthy within 60 seconds. Verify:

```bash
docker compose ps
docker compose logs -f sim-gps-puck
```

### Endpoints

| Service | URL | Notes |
|---|---|---|
| Dashboard | http://localhost:3000 | Login: any non-empty username, password `will-dev` |
| WILL Core stub | http://localhost:7443/healthz | Real fork lands in Sprint 1+ |
| WebSocket bridge healthz | http://localhost:7000/healthz | |
| WebSocket bridge tracks | ws://localhost:7000/tracks | Push-only |
| EMQX dashboard | http://localhost:18083 | admin / `will-dev` |
| PostgreSQL | localhost:5432 | will / will-dev / will |

### Tear down

```bash
docker compose down -v
```

`-v` removes volumes; omit it if you want to keep the database between runs.

### Troubleshooting

- **`flyway` exits with `Connection refused`.** Postgres healthcheck not yet green; rerun `docker compose up -d` once.
- **Cesium globe blank.** Browser has not yet downloaded the Cesium worker bundles; reload after a few seconds. Provide a Cesium Ion token for richer imagery.
- **Port already in use.** Edit `docker-compose.yml` to remap the offending port.

---

## Română

### Cerințe

- Docker Engine 24+ și Docker Compose v2.
- Minim 16 GB RAM și 4 vCPU pe stația de lucru.
- Token Cesium Ion pentru imagistică detaliată (opțional în Sprint 0).

### Pornire inițială

```bash
cd will-platform
cp .env.example .env
# (opțional, editați .env pentru a seta VITE_CESIUM_ION_TOKEN)
docker compose up -d
```

Toate containerele trebuie să devină „healthy” în maximum 60 de secunde. Verificare:

```bash
docker compose ps
docker compose logs -f sim-gps-puck
```

### Puncte de acces

| Serviciu | URL | Observații |
|---|---|---|
| Tablou de bord | http://localhost:3000 | Autentificare: orice utilizator nevid, parola `will-dev` |
| WILL Core (stub) | http://localhost:7443/healthz | Forkul real ajunge în Sprint 1+ |
| WebSocket bridge healthz | http://localhost:7000/healthz | |
| Track-uri WebSocket | ws://localhost:7000/tracks | Doar push |
| Dashboard EMQX | http://localhost:18083 | admin / `will-dev` |
| PostgreSQL | localhost:5432 | will / will-dev / will |

### Oprire

```bash
docker compose down -v
```

`-v` șterge volumele; omiteți dacă doriți să păstrați baza de date între execuții.

### Depanare

- **`flyway` se închide cu „Connection refused”.** Healthcheck-ul Postgres nu este încă verde; rulați din nou `docker compose up -d`.
- **Globul Cesium este gol.** Worker-ele Cesium nu s-au descărcat încă; reîncărcați pagina după câteva secunde. Setați un token Cesium Ion pentru imagistică completă.
- **Port deja folosit.** Editați `docker-compose.yml` pentru a re-mapa portul afectat.
