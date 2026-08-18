"""Mock Skynex / Oerlikon GDF-103 effector — reference will.effector.v1
gun_shorad plugin. Emits Status reports as JSON lines (same pattern as
sam-battery-mock). Close-in C-RAM / C-UAS 35 mm AHEAD gun with Skymaster
fire control and a 3D acquisition radar.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import signal
import sys
import time

NAME = os.environ.get("NAME", "Skynex Bty (GDF-103)")
LAT = float(os.environ.get("LAT", "45.872"))
LON = float(os.environ.get("LON", "24.776"))
ROUNDS = int(os.environ.get("ROUNDS", "1200"))
PERIOD_S = float(os.environ.get("PERIOD_S", "5"))


def main() -> int:
    stop = False

    def handle(_s, _f):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle)
    signal.signal(signal.SIGINT, handle)

    print(json.dumps({"event": "describe", "data": {
        "name": NAME, "version": "0.1.0", "vendor": "WILL Romania",
        "contract_version": "v1.0",
        "capabilities": ["effector.gun.shorad", "effector.c_ram", "effector.c_uas"],
        "description": "Skynex/GDF-103 35 mm AHEAD; Skymaster FC + 3D radar (public-domain envelope).",
        "envelope": {"min_range_m": 100, "max_range_m": 4000,
                      "min_altitude_m": 0, "max_altitude_m": 3500,
                      "max_target_speed_mps": 1000},
        "kind": "EFFECTOR_KIND_GUN_SHORAD",
    }}), flush=True)

    rounds = ROUNDS
    while not stop:
        print(json.dumps({"event": "status", "data": {
            "effector_id": NAME, "kind": "EFFECTOR_KIND_GUN_SHORAD",
            "mode": "READY" if rounds > 0 else "RELOADING",
            "rounds_remaining": rounds,
            "lat": LAT, "lon": LON, "classification": "NESECRET",
            "observed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        }}), flush=True)
        time.sleep(PERIOD_S)
    return 0


if __name__ == "__main__":
    sys.exit(main())
