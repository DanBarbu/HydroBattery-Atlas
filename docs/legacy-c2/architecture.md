# Legacy C2 Bridge — Architecture

ADR-014. Interoperates with **BC2A®** (Interactive Software / ISW) over
**ICIS**, the Romanian Land Forces C2 baseline, using public NATO
standards: **JC3IEDM / MIP**, **AdatP-3**, **MIL-STD-2525D / APP-6(C/D)**.

## The boundary (read this first)

WILL **wraps, it does not rewrite**. BC2A is treated as a sensor data
source (the publicly-documented Phase-1 "Protocol Adapter Layer"
approach). WILL **never writes BC2A's database and never commands BC2A**.
The southbound path is *advisory / display backwards-compat*: WILL renders
the fused picture to 2525D + AdatP-3; the **customer's ICIS gateway**, not
WILL, injects it into BC2A client loops.
`api_test.go::TestNoLegacyWriteOrCommandRoutes` asserts no write/command
route exists. Built from public NATO standards only — no proprietary
BC2A/ISW code, schema, or trade secret.

## Data flow

```
BC2A / ICIS                 legacy-c2 (Protocol Adapter Layer)         WILL COP
 ┌──────────┐  JC3IEDM      ┌───────────────────────────────┐
 │ BC2A      │ ───────────▶ │ jc3iedm.Decode (min profile)  │ ─┐
 │ clients   │  AdatP-3      │ adatp3.Parse  (min profile)  │  ├─▶ normalised
 │ over ICIS │ ───────────▶ │ app6.SIDC (2525C/APP-6)       │  │   tracks
 └────▲─────┘               │ store (tenant-isolated)       │ ─┘   (BC2A as
      │  2525D + AdatP-3     │ southbound.Render (advisory)  │ ◀─    a sensor
      └──────────────────────┤ /v1/southbound/feed           │       source)
   (ICIS gateway injects;    └───────────────────────────────┘
    NOT WILL)
```

## Northbound — ingest & abstract (Phase 1)

| Input | Parser | Output |
|---|---|---|
| JC3IEDM object/track record (from a MIP/JC3IEDM replication gateway) | `internal/jc3iedm` minimal profile | canonical track + APP-6 SIDC + STANAG-4774 class |
| AdatP-3 TRACKREP message | `internal/adatp3` minimal profile | canonical track + APP-6 SIDC + class |

Both parsers are defensive (size-capped, range-checked, hostile input
never panics) — the same discipline as the STANAG 4607 and NFFI decoders.
Wire-level MIP binary replication and the full AdatP-3 message catalogue
are declared additive follow-ups.

## Southbound — backwards compatibility

`POST /v1/southbound/render` turns a canonical track into a MIL-STD-2525C
/ APP-6 15-char SIDC plus a WILL-minimal AdatP-3 TRACKREP, appended to a
capped rolling feed (`/v1/southbound/feed`). This keeps legacy BC2A
operators in the loop while the autonomous picture runs ahead — exactly
the roadmap's "southbound data pipeline … injected back into BC2A
clients". The injection is performed by the customer ICIS gateway.

## Classification preservation (ADR-005)

JC3IEDM / AdatP-3 security codes map to STANAG 4774 / RO national
markings and **never downgrade**: an unrecognised code is treated as the
most restrictive of the mapped set. The southbound render maps back to the
AdatP-3 CLASS code.

| NATO code | RO marking |
|---|---|
| NU / UNCLAS | NESECRET |
| RS / RESTRICTED | SECRET_DE_SERVICIU |
| CO / CONFIDENTIAL | SECRET |
| SE / SECRET | STRICT_SECRET |
| (unrecognised) | STRICT_SECRET |

## HTTP surface

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/healthz` | – | declares `mode: legacy-c2-bridge` |
| POST | `/v1/ingest/jc3iedm` | operator | ingest a JC3IEDM record |
| POST | `/v1/ingest/adatp3` | operator | ingest an AdatP-3 TRACKREP |
| GET | `/v1/tracks` | operator | WILL-normalised legacy tracks |
| POST | `/v1/southbound/render` | operator | render one track → 2525D + AdatP-3 |
| GET | `/v1/southbound/feed` | operator | rolling rendered feed |

## Demo (bc2a-sim + demo-ux)

`bc2a-sim` simulates the ICIS replication near Cincu: a friendly company
(`OI-LF-21`, RS), an unknown contact (`OI-UNK-77`), an AdatP-3 recce
TRACKREP, and a southbound render of the unknown. The demo-ux **Legacy
C2** view shows the three flows side by side: northbound ingest, the
canonical tracks BC2A contributes to the COP, and the southbound 2525D +
AdatP-3 feed with the advisory/backwards-compat note.
