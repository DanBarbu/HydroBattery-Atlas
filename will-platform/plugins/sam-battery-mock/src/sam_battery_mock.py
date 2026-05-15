"""Mock SAM battery effector — reference implementation of will.effector.v1.

The real plugin is gRPC; this demo plugin emits Status reports as JSON lines
to stdout on a fixed cadence so the BMS service and demo-ux app can show a
plausible effector without bringing up generated stubs.

Romanian-context defaults: Patriot Bn 1 emplaced near the Cincu range.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import signal
import sys
import time

NAME = os.environ.get("NAME", "Patriot Bn 1")
LAT = float(os.environ.get("LAT", "45.87"))
LON = float(os.environ.get("LON", "24.78"))
ROUNDS = int(os.environ.get("ROUNDS", "8"))
PERIOD_S = float(os.environ.get("PERIOD_S", "5"))


def main() -> int:
    stop = False

    def handle(_s, _f):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle)
    signal.signal(signal.SIGINT, handle)

    print(json.dumps({
        "event": "describe",
        "data": {
            "name": NAME, "version": "0.1.0", "vendor": "WILL Romania",
            "contract_version": "v1.0",
            "capabilities": ["effector.sam.area"],
            "description": "Patriot-class fire-unit emulator (publicly-documented capability).",
            "envelope": {"min_range_m": 3000, "max_range_m": 80000,
                          "min_altitude_m": 50, "max_altitude_m": 25000,
                          "max_target_speed_mps": 2400},
            "kind": "EFFECTOR_KIND_SAM_AREA",
        },
    }), flush=True)

    rounds = ROUNDS
    while not stop:
        print(json.dumps({
            "event": "status",
            "data": {
                "effector_id": NAME, "kind": "EFFECTOR_KIND_SAM_AREA",
                "mode": "READY" if rounds > 0 else "RELOADING",
                "rounds_remaining": rounds,
                "lat": LAT, "lon": LON, "classification": "NESECRET",
                "observed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            },
        }), flush=True)
        time.sleep(PERIOD_S)
    return 0


if __name__ == "__main__":
    sys.exit(main())
