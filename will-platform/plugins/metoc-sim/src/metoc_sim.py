"""METOC provider simulator. ADR-015.

Feeds the METOC service the way a real weather/ocean provider adapter would:
  - a Cincu (LRCV) METAR observation that cycles clear -> fog -> wind -> icing
  - a TAF-style forecast block for the next few hours
  - a western Black-Sea surface flow field (a handful of current samples off
    Constanța, broadly cyclonic / north-westward — the Rim Current)

It POSTs awareness data only. There is no tasking endpoint to call: METOC is
advisory. The drifting-sensor release is expressed as a Lagrangian *query*
(where will it go), not a command to put anything there.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import signal
import sys
import time
import urllib.request

BASE = os.environ.get("METOC_URL", "http://metoc:8090")
PERIOD_S = float(os.environ.get("PERIOD_S", "6"))
TENANT_ID = os.environ.get("TENANT_ID", "00000000-0000-0000-0000-000000000001")


def _req(path: str, body, raw: bool = False):
    data = body.encode("utf-8") if raw else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method="POST",
        headers={
            "content-type": "text/plain" if raw else "application/json",
            "x-will-role": "operator",
            "x-will-tenant": TENANT_ID,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            resp.read()
    except Exception as exc:  # pragma: no cover - best effort
        print(f"[metoc-sim] POST {path} failed: {exc}", file=sys.stderr, flush=True)


def iso(offset_s: float = 0.0) -> str:
    return (
        (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=offset_s))
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def ddhhmmZ(offset_s: float = 0.0) -> str:
    t = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=offset_s)
    return t.strftime("%d%H%MZ")


# Cincu (LRCV) METAR weather cycle: clear -> fog -> high wind -> icing.
METAR_CYCLE = [
    "LRCV {t} 18004KT 9999 FEW040 18/09 Q1018",          # clear: all GO
    "LRCV {t} 18003KT 0800 BKN001 02/02 Q1013",          # fog/low ceiling
    "LRCV {t} 21016G22KT 9999 BKN030 12/04 Q1009",       # high wind
    "LRCV {t} 02006KT 1200 -SN BKN008 00/M01 Q1011",     # icing risk
]

# Western Black-Sea surface flow field off Constanța (approx Rim Current).
FLOW = [
    {"lat": 44.10, "lon": 29.00, "u_east_mps": -0.12, "v_north_mps": 0.10},
    {"lat": 44.20, "lon": 29.40, "u_east_mps": -0.09, "v_north_mps": 0.14},
    {"lat": 43.95, "lon": 29.20, "u_east_mps": -0.14, "v_north_mps": 0.08},
    {"lat": 44.30, "lon": 28.90, "u_east_mps": -0.07, "v_north_mps": 0.12},
]


def main() -> int:
    stop = False

    def handle(_s, _f):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle)
    signal.signal(signal.SIGINT, handle)

    print(f"[metoc-sim] advisory weather/ocean provider -> {BASE}", flush=True)
    step = 0
    while not stop:
        metar = METAR_CYCLE[step % len(METAR_CYCLE)].format(t=ddhhmmZ())
        _req("/v1/obs/metar", metar, raw=True)

        # Black-Sea naval observation (sea state cycles with wind phase).
        sea_state = [1, 2, 5, 3][step % 4]
        _req("/v1/obs/ingest", {
            "station": "BS-CONSTANTA",
            "lat": 44.17, "lon": 28.65,
            "observed_at": iso(),
            "wind_dir_deg": 200, "wind_speed_mps": 6 + 2 * (step % 4),
            "visibility_m": 12000, "sea_state": sea_state,
            "wave_height_m": 0.5 * sea_state, "source": "buoy",
        })

        # TAF-style forecast block.
        _req("/v1/forecast/ingest", {
            "station": "LRCV",
            "valid_from": iso(), "valid_to": iso(6 * 3600),
            "wind_dir_deg": 210, "wind_speed_mps": 9, "gust_mps": 14,
            "visibility_m": 8000, "ceiling_m": 600, "precip": "light",
            "provider": "taf",
        })

        # Flow field (re-sent so a late-joining METOC has the field).
        for fs in FLOW:
            sample = dict(fs)
            sample["valid_at"] = iso()
            sample["provider"] = "blacksea-rim-current"
            _req("/v1/flowfield/ingest", sample)

        # Lagrangian *query*: where would a low-cost floating sensor released
        # off Constanța drift over the next 6 h? Advisory — not a tasking.
        _req("/v1/lagrangian/drift", {
            "lat": 44.05, "lon": 29.30,
            "duration_s": 6 * 3600, "step_s": 1800,
            "windage": 0.02, "wind_u_east_mps": -3.0, "wind_v_north_mps": 1.0,
        })

        step += 1
        time.sleep(PERIOD_S)
    return 0


if __name__ == "__main__":
    sys.exit(main())
