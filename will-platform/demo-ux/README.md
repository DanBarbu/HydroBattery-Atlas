# WILL Romania — Standalone UX Demo

A self-contained preview of the WILL operator and admin user experience.
**No backend. No Docker. No Postgres. No MQTT.** Mock data only — suitable for
UX review, stakeholder walkthroughs, and screenshots.

For the real, integrated platform see [`../README.md`](../README.md) and run
the full `docker compose up` from the `will-platform/` directory.

## Run it

```bash
cd will-platform/demo-ux
npm install
npm run dev
# open http://localhost:5173
```

Or build static files:

```bash
npm run build         # output in dist/
npm run preview        # serve dist/ on http://localhost:4173
```

## What you can click through

### Login
Any non-empty username; password `will-dev`. (No real auth — this is a demo.)

### Operations view
- A CesiumJS globe centred on the **Cincu Joint National Training Centre**, using
  the offline Natural Earth II imagery bundled with Cesium (no Ion token needed).
- Live (mock) tracks updating every second:
  - **CoT (ATAK-MIL)** — ALFA-1 friendly circling; BANDIT-99 hostile transiting at 3 km.
  - **MAVLink (UAV)** — UAV-1 circling at 500 m.
  - **GMTI (Radar)** — three RAT-31DL ground vehicles with directional radial-velocity labels.
  - **Point / IoT** — 100 LoRa nodes scattered over the range (toggle on to see them).
- **Layer toggles** — hide/reveal each track family.
- **Plugin Info panel** — six mock plugins with status and jittering latency
  (one shows `DEGRADED`). Plugin names and descriptions pass through the active
  tenant's terminology overrides.
- **Re-centre on Cincu** button.

### Admin view
- **Tenants list** — `default` and `Brigada 2 Vânători de Munte (Demo)`. Each has
  a **set active** button; the active tenant drives the classification banner,
  affiliation colours, and terminology across the whole UI.
- **Theme tab** — edit a JSON theme (`primaryColor`, `bannerLabel`,
  `affiliationColors`). Save and watch the operator view rebrand.
- **Terminology tab** — edit a JSON map (e.g. `{"plugin": "module"}`). Save and
  watch the Plugin Info panel header and descriptions change.
- **Sensors tab** — bulk-register sensors from a JSON array; the registered list
  updates in place.
- **Members tab** — grant/revoke tenant-scoped roles (viewer / operator / admin /
  auditor / cross_tenant_auditor).

### Bilingual
Top-right toggle switches the entire UI between English and Romanian, including
error messages.

## What it deliberately does NOT do

- No real authentication, no NPKI, no OIDC.
- No real STANAG 4607 / CoT / MAVLink / LoRaWAN decoding — the tracks are
  generated client-side. The real decoders live in `../plugins/`.
- No persistence — reload resets everything to the seed state.
- No real classification controls — the banner is cosmetic here. In the real
  platform classification is structural (STANAG 4774; see `../../docs/adr/ADR-005-*`).

## Relationship to the real frontend

`../frontend/` is the production React app: same look and feel, but it talks to
the real services (`plugin-loader`, `tenant-admin`, `websocket-bridge`,
`core-sync`) and requires the full compose stack. This `demo-ux/` app is the
zero-dependency sibling for UX work.
