"""MAVLink simulator for the Sprint 2 demo.

Sends synthetic HEARTBEAT + GLOBAL_POSITION_INT to the mavlink plugin's UDP
listener so the demo and CI integration test never depend on a real
autopilot. Trajectory: a slow circle over the Cincu range at 500 m AGL.
"""
from __future__ import annotations

import math
import os
import signal
import sys
import time

from pymavlink import mavutil

TARGET_URL = os.environ.get("MAVLINK_TARGET", "udpout:mavlink:14550")
SYSID = int(os.environ.get("SYSID", "1"))
COMPID = int(os.environ.get("COMPID", "1"))
PERIOD_S = float(os.environ.get("PERIOD_S", "1"))

CENTER_LAT = 45.8696
CENTER_LON = 24.7753
EARTH_R = 6_378_137.0
RADIUS_M = 1500


def offset(lat: float, lon: float, north_m: float, east_m: float) -> tuple[float, float]:
    dlat = north_m / EARTH_R
    dlon = east_m / (EARTH_R * math.cos(math.radians(lat)))
    return lat + math.degrees(dlat), lon + math.degrees(dlon)


def main() -> int:
    conn = mavutil.mavlink_connection(TARGET_URL, source_system=SYSID, source_component=COMPID)
    print(f"[mavlink-sim] sending to {TARGET_URL} as sys={SYSID}", flush=True)

    stop = False

    def handle_sigterm(_signum, _frame):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    t0 = time.time()
    while not stop:
        elapsed = time.time() - t0
        theta = (elapsed / 60.0) * 2 * math.pi
        lat, lon = offset(CENTER_LAT, CENTER_LON, RADIUS_M * math.sin(theta), RADIUS_M * math.cos(theta))
        heading_cdeg = int((math.degrees(theta) + 90.0) % 360.0 * 100)

        # HEARTBEAT — vehicle type 2 (QUADROTOR), autopilot 3 (ArduPilotMega)
        conn.mav.heartbeat_send(
            type=2,
            autopilot=3,
            base_mode=0,
            custom_mode=0,
            system_status=4,
        )
        # GLOBAL_POSITION_INT
        conn.mav.global_position_int_send(
            time_boot_ms=int(elapsed * 1000),
            lat=int(lat * 1e7),
            lon=int(lon * 1e7),
            alt=int(500 * 1000),  # mm AMSL
            relative_alt=int(500 * 1000),
            vx=int(math.cos(theta) * 100),
            vy=int(math.sin(theta) * 100),
            vz=0,
            hdg=heading_cdeg,
        )
        time.sleep(PERIOD_S)
    return 0


if __name__ == "__main__":
    sys.exit(main())
