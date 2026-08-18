"""Mock F-16 combat-air-patrol effector — reference will.effector.v1
air_intercept plugin. A fighter on station is modelled as an effector
whose 'rounds' are its air-to-air missile loadout (AIM-120 AMRAAM /
AIM-9X). It loiters its CAP racetrack and reports Status.

WILL is a coordinator: the actual intercept and weapons-release decision
remain with the aircrew and the fighter's own fire-control. ADR-008.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import os
import signal
import sys
import time

NAME = os.environ.get("NAME", "F-16 CAP SOIM-01")
CAP_LAT = float(os.environ.get("CAP_LAT", "45.80"))
CAP_LON = float(os.environ.get("CAP_LON", "24.55"))
LOADOUT = int(os.environ.get("LOADOUT", "8"))  # e.g. 6× AIM-120 + 2× AIM-9X
PERIOD_S = float(os.environ.get("PERIOD_S", "5"))
RACETRACK_M = 12_000
EARTH_R = 6_378_137.0


def offset(lat, lon, north_m, east_m):
    dlat = (north_m / EARTH_R) * (180 / math.pi)
    dlon = (east_m / (EARTH_R * math.cos(math.radians(lat)))) * (180 / math.pi)
    return lat + dlat, lon + dlon


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
        "capabilities": ["effector.air_intercept.bvr", "effector.air_intercept.wvr"],
        "description": "F-16 CAP; AIM-120 AMRAAM / AIM-9X loadout (public-domain envelope).",
        "envelope": {"min_range_m": 2000, "max_range_m": 100000,
                      "min_altitude_m": 30, "max_altitude_m": 18000,
                      "max_target_speed_mps": 900},
        "kind": "EFFECTOR_KIND_AIR_INTERCEPT",
    }}), flush=True)

    loadout = LOADOUT
    t0 = time.time()
    while not stop:
        # Fly a simple racetrack around the CAP point.
        theta = ((time.time() - t0) / 120.0) * 2 * math.pi
        lat, lon = offset(CAP_LAT, CAP_LON, RACETRACK_M * math.sin(theta), RACETRACK_M * math.cos(theta))
        print(json.dumps({"event": "status", "data": {
            "effector_id": NAME, "kind": "EFFECTOR_KIND_AIR_INTERCEPT",
            "mode": "READY" if loadout > 0 else "WINCHESTER",
            "rounds_remaining": loadout,
            "lat": round(lat, 6), "lon": round(lon, 6),
            "classification": "NESECRET",
            "observed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        }}), flush=True)
        time.sleep(PERIOD_S)
    return 0


if __name__ == "__main__":
    sys.exit(main())
