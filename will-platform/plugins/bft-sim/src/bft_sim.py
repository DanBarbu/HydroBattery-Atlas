"""BFT simulator — a Romanian order of battle around the Cincu range.

Posts WILL-native friendly-asset reports to the BFT service every PERIOD_S
seconds. Demonstrates the four land programmes the integration analysis
flagged (Lynx KF41, M1A2 Abrams, Cobra II, Piranha V) plus a friendly air
pair (F-16) and a dismounted team — exactly the assets that today are only
visible if someone runs ATAK on them.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import os
import signal
import sys
import time
import urllib.request

BFT_URL = os.environ.get("BFT_URL", "http://bft:8085/v1/friendly-assets/report")
PERIOD_S = float(os.environ.get("PERIOD_S", "5"))
TENANT_ID = os.environ.get("TENANT_ID", "00000000-0000-0000-0000-000000000001")

CENTER_LAT = 45.8696
CENTER_LON = 24.7753
EARTH_R = 6_378_137.0

# (external_id, callsign, platform_type, branch, echelon, ring_radius_m, speed_mps, phase)
OOB = [
    ("LYNX-21", "VANATOR-21", "lynx_kf41", "land", "company", 1800, 7.0, 0.0),
    ("LYNX-22", "VANATOR-22", "lynx_kf41", "land", "company", 1800, 7.0, 1.0),
    ("ABRAMS-07", "TUNARI-07", "m1a2_abrams", "land", "battalion", 2600, 6.0, 0.7),
    ("COBRA-3", "LUPUL-3", "cobra_ii", "land", "platoon", 1200, 12.0, 2.1),
    ("PIRANHA-5", "SCORPION-5", "piranha_v", "land", "company", 3000, 9.0, 3.4),
    ("F16-01", "SOIM-01", "f16", "air", "squad", 9000, 220.0, 0.0),
    ("F16-02", "SOIM-02", "f16", "air", "squad", 9000, 220.0, 3.14),
    ("DISM-1", "CERCETAS-1", "dismounted", "sof", "team", 600, 1.4, 5.0),
]


def offset(lat, lon, north_m, east_m):
    dlat = (north_m / EARTH_R) * (180 / math.pi)
    dlon = (east_m / (EARTH_R * math.cos(math.radians(lat)))) * (180 / math.pi)
    return lat + dlat, lon + dlon


def post(payload: dict) -> None:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        BFT_URL, data=data, method="POST",
        headers={
            "content-type": "application/json",
            "x-will-bft-format": "will_native",
            "x-will-role": "operator",
            "x-will-tenant": TENANT_ID,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            resp.read()
    except Exception as exc:  # pragma: no cover - best effort
        print(f"[bft-sim] post failed: {exc}", file=sys.stderr, flush=True)


def main() -> int:
    stop = False

    def handle(_s, _f):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle)
    signal.signal(signal.SIGINT, handle)

    print(f"[bft-sim] posting {len(OOB)} friendly assets to {BFT_URL}", flush=True)
    t0 = time.time()
    while not stop:
        elapsed = time.time() - t0
        for ext, cs, ptype, branch, ech, radius, speed, phase in OOB:
            # Each asset orbits its own ring at its own rate.
            omega = speed / radius if radius else 0.0
            theta = phase + omega * elapsed
            north = radius * math.sin(theta)
            east = radius * math.cos(theta)
            lat, lon = offset(CENTER_LAT, CENTER_LON, north, east)
            heading = (math.degrees(theta) + 90.0) % 360.0
            status = "OPERATIONAL"
            if ext == "F16-02" and int(elapsed) % 120 > 90:
                status = "BINGO"  # demonstrate the air fuel state
            post({
                "external_id": ext,
                "callsign": cs,
                "platform_type": ptype,
                "branch": branch,
                "echelon": ech,
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "heading_deg": round(heading, 1),
                "speed_mps": speed,
                "status": status,
                "classification": "NESECRET",
                "observed_at": dt.datetime.now(dt.timezone.utc)
                .replace(microsecond=0)
                .isoformat()
                .replace("+00:00", "Z"),
                "metadata": {"sim": True},
            })
        time.sleep(PERIOD_S)
    return 0


if __name__ == "__main__":
    sys.exit(main())
