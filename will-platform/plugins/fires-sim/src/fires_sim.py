"""Fires-C2 (AFATDS-style) READ-ONLY feed simulator. ADR-012.

Posts Fire Support Coordination Measures and a HIMARS fire-mission STATUS
to the fires service. This simulates the authoritative fires C2 SENDING
awareness data to WILL. It never tasks anything — there is no tasking
endpoint to call.

Scenario near the Cincu range:
  - NFA over Cincu HQ (always active)
  - FSCL line east of the range (always active)
  - ACA "CINCU CORRIDOR" over the gun-target line, 300-3000 m, active in
    bursts that coincide with the HIMARS fire-mission IN_PROGRESS/SHOT
  - One HIMARS Bn fire-mission status cycling
    PLANNED -> IN_PROGRESS -> SHOT -> SPLASH -> COMPLETE, referencing the ACA
"""
from __future__ import annotations

import datetime as dt
import json
import os
import signal
import sys
import time
import urllib.request

BASE = os.environ.get("FIRES_URL", "http://fires:8087")
PERIOD_S = float(os.environ.get("PERIOD_S", "5"))
TENANT_ID = os.environ.get("TENANT_ID", "00000000-0000-0000-0000-000000000001")


def _post(path: str, body: dict) -> None:
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "content-type": "application/json",
            "x-will-role": "operator",
            "x-will-tenant": TENANT_ID,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            resp.read()
    except Exception as exc:  # pragma: no cover - best effort
        print(f"[fires-sim] POST {path} failed: {exc}", file=sys.stderr, flush=True)


def iso(offset_s: float = 0.0) -> str:
    return (
        (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=offset_s))
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


# Static measures (re-sent every cycle so a late-joining WILL still sees them).
NFA = {
    "external_id": "NFA-CINCU-HQ",
    "measure_type": "NFA",
    "name": "NFA Cincu HQ",
    "polygon": [[24.755, 45.855], [24.795, 45.855], [24.795, 45.885], [24.755, 45.885], [24.755, 45.855]],
}
FSCL = {
    "external_id": "FSCL-EAST",
    "measure_type": "FSCL",
    "name": "FSCL EAST",
    "polygon": [[25.10, 45.60], [25.12, 46.10]],  # LineString-ish
}
ACA = {
    "external_id": "ACA-CINCU-CORRIDOR",
    "measure_type": "ACA",
    "name": "ACA Cincu Corridor",
    "polygon": [[24.80, 45.80], [25.05, 45.80], [25.05, 45.95], [24.80, 45.95], [24.80, 45.80]],
    "min_alt_m": 300,
    "max_alt_m": 3000,
}

# HIMARS fire-mission STATUS cycle (status only — no targeting/tasking).
CYCLE = ["PLANNED", "IN_PROGRESS", "SHOT", "SPLASH", "COMPLETE"]


def main() -> int:
    stop = False

    def handle(_s, _f):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle)
    signal.signal(signal.SIGINT, handle)

    print(f"[fires-sim] AFATDS-style read-only feed -> {BASE}", flush=True)
    step = 0
    while not stop:
        phase = CYCLE[step % len(CYCLE)]
        active = phase in ("IN_PROGRESS", "SHOT")

        # NFA + FSCL: always active (no effective window).
        _post("/v1/fscm/ingest", NFA)
        _post("/v1/fscm/ingest", FSCL)

        # ACA: active window only while rounds are downrange.
        aca = dict(ACA)
        if active:
            aca["effective_from"] = iso(-30)
            aca["effective_to"] = iso(120)
        else:
            # Expired window so it shows but is not "active".
            aca["effective_from"] = iso(-3600)
            aca["effective_to"] = iso(-1800)
        _post("/v1/fscm/ingest", aca)

        # Fire-mission STATUS only.
        _post("/v1/fire-missions/ingest-status", {
            "external_id": "FM-HIMARS-001",
            "status": phase,
            "firing_unit": "HIMARS Bn (display label only)",
            "aca_ref": "ACA-CINCU-CORRIDOR",
            "target_lat": 45.905,
            "target_lon": 24.930,
            "eta_splash": iso(20) if phase in ("IN_PROGRESS", "SHOT") else None,
            "observed_at": iso(),
        })

        step += 1
        time.sleep(PERIOD_S)
    return 0


if __name__ == "__main__":
    sys.exit(main())
