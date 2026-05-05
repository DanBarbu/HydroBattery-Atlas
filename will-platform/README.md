# WILL Romania Platform — Developer Skeleton (Sprint 0 Output)

This directory holds the running skeleton produced by Sprint 0 — the foundations on which Sprints 1–15 are built.

## Layout

```
will-platform/
├── docker-compose.yml             # Orchestrates the dev environment
├── .env.example                   # Copy to .env before first bring-up
├── .gitlab-ci.yml                 # Lint / test / build / Trivy / Grype / canary
├── contracts/proto/will/sensor/v1 # Plugin SDK gRPC contract (Sprint 1)
├── docker/
│   ├── postgres/init.sql          # Bootstraps PostGIS extensions
│   └── will-core-stub/            # FastAPI healthz stub (real fork: Sprint 1+)
├── db/migrations/                 # Flyway migrations (V0001 tracks + classification)
├── plugins/
│   ├── sim-gps-puck/              # Sprint 0 simulated GPS plugin
│   ├── reference-echo/            # Sprint 1 reference plugin (tutorial target)
│   ├── atak-mil/                  # Sprint 1 ATAK-MIL CoT adapter (Go)
│   └── cot-replay/                # Sprint 1 synthetic CoT generator (demo aid)
├── services/
│   ├── websocket-bridge/          # MQTT → WebSocket relay with dedup
│   └── plugin-loader/             # Sprint 1 plugin loader + /v1/plugins API
└── frontend/                      # React + Vite + CesiumJS dashboard with RO/EN i18n
```

## Quick start

```bash
cp .env.example .env
docker compose up -d
open http://localhost:3000   # login any user / will-dev
```

See [`docs/setup/dev-environment.md`](../docs/setup/dev-environment.md) for the bilingual operator-grade walkthrough.

## What Sprint 0 produces

- A `docker compose up` that brings the stack to green in under a minute.
- A simulated GPS plugin publishing 1 Hz tracks to EMQX.
- A WebSocket bridge that dedups by `(source, observed_at)` and pushes JSON to clients.
- A React + CesiumJS dashboard that renders a moving APP-6D-styled marker over the Cincu range.
- A bilingual (RO / EN) login screen with a language toggle and full string parity.
- A PostgreSQL/PostGIS schema with a `classification` column accepting both Romanian (Law 182/2002) and NATO marking values.
- A GitLab CI scaffolding with Trivy and Grype scans and a canary job that proves the failure policy works.
- Five ADRs in [`docs/adr/`](../docs/adr/) capturing the decisions this sprint commits to.

## What Sprint 0 deliberately does not do

See [`docs/sprints/sprint-00/sprint-plan.md`](../docs/sprints/sprint-00/sprint-plan.md) §8.
