"""CoT replay simulator for the Sprint 1 demo.

Sends synthetic ATAK-MIL-style CoT XML packets over UDP to the atak-mil
adapter so the end-to-end pipeline can be demonstrated without a physical
tablet. Real field-test on a tablet is documented in
docs/field-tests/sprint-01-atak-mil.md.

Two simulated tracks: one friendly land unit moving north over Cincu, one
hostile air contact transiting east-to-west at 3 km altitude.
"""
from __future__ import annotations

import datetime as dt
import math
import os
import signal
import socket
import sys
import time

ATAK_HOST = os.environ.get("ATAK_HOST", "atak-mil")
ATAK_PORT = int(os.environ.get("ATAK_PORT", "8087"))
PERIOD_S = float(os.environ.get("PERIOD_S", "1"))

CENTER_LAT = 45.8696
CENTER_LON = 24.7753
EARTH_R = 6_378_137.0

CONTACTS = [
    {
        "uid": "tablet-7",
        "type": "a-f-G-U-C-I",  # friendly ground unit, combat infantry
        "callsign": "ALPHA-1",
        "group": "Cyan",
        "alt": 500.0,
        "speed": 3.5,
    },
    {
        "uid": "track-99",
        "type": "a-h-A-M-F",  # hostile air, military, fighter
        "callsign": "BANDIT-99",
        "group": "Red",
        "alt": 3000.0,
        "speed": 220.0,
    },
]


def offset(lat: float, lon: float, north_m: float, east_m: float) -> tuple[float, float]:
    dlat = north_m / EARTH_R
    dlon = east_m / (EARTH_R * math.cos(math.radians(lat)))
    return lat + math.degrees(dlat), lon + math.degrees(dlon)


def cot_xml(c: dict, lat: float, lon: float, course: float) -> bytes:
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    stale = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    return (
        f'<event uid="{c["uid"]}" type="{c["type"]}" '
        f'time="{now}" start="{now}" stale="{stale}">'
        f'<point lat="{lat:.6f}" lon="{lon:.6f}" hae="{c["alt"]}" ce="9999999" le="9999999"/>'
        f'<detail>'
        f'<contact callsign="{c["callsign"]}"/>'
        f'<__group name="{c["group"]}"/>'
        f'<track course="{course:.1f}" speed="{c["speed"]}"/>'
        f'</detail>'
        f'</event>'
    ).encode("utf-8")


def main() -> int:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    stop = False

    def handle_sigterm(_signum, _frame):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    print(f"[cot-replay] target {ATAK_HOST}:{ATAK_PORT} period {PERIOD_S}s", flush=True)
    t0 = time.time()
    while not stop:
        elapsed = time.time() - t0
        # Friendly: slow circle, 1 km radius
        theta_f = (elapsed / 60.0) * 2 * math.pi
        flat, flon = offset(CENTER_LAT, CENTER_LON, 1000 * math.sin(theta_f), 1000 * math.cos(theta_f))
        # Hostile: linear east-to-west pass at 5 km north of centre
        hostile_east_m = 30_000 - (elapsed * 220) % 60_000
        hlat, hlon = offset(CENTER_LAT, CENTER_LON, 5_000, hostile_east_m)

        for c, lat, lon, course in (
            (CONTACTS[0], flat, flon, math.degrees(theta_f) % 360),
            (CONTACTS[1], hlat, hlon, 270.0),
        ):
            try:
                sock.sendto(cot_xml(c, lat, lon, course), (ATAK_HOST, ATAK_PORT))
            except OSError as exc:
                print(f"[cot-replay] send: {exc}", file=sys.stderr, flush=True)

        time.sleep(PERIOD_S)

    sock.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
