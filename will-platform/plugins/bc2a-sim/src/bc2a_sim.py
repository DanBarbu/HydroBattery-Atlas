"""BC2A / ICIS replication feed simulator. ADR-014.

Simulates a MIP/JC3IEDM replication gateway and an AdatP-3 message loop
forwarding the Land Forces picture near Cincu to the WILL legacy-c2
bridge. One-way: BC2A/ICIS -> WILL (WILL never writes BC2A's DB).

Emits:
  - JC3IEDM object-item records (friendly company, an unknown contact)
  - one AdatP-3 TRACKREP (a friendly recce element)
All moving slowly around the Cincu range; RS classification on the
friendly unit to exercise the classification mapping.
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

BASE = os.environ.get("LEGACY_C2_URL", "http://legacy-c2:8089")
PERIOD_S = float(os.environ.get("PERIOD_S", "5"))
TENANT_ID = os.environ.get("TENANT_ID", "00000000-0000-0000-0000-000000000001")

C_LAT, C_LON = 45.8696, 24.7753
EARTH_R = 6_378_137.0


def offset(lat, lon, north_m, east_m):
    dlat = (north_m / EARTH_R) * (180 / math.pi)
    dlon = (east_m / (EARTH_R * math.cos(math.radians(lat)))) * (180 / math.pi)
    return lat + dlat, lon + dlon


def iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def post(path: str, raw: bytes, ctype: str) -> None:
    req = urllib.request.Request(
        BASE + path, data=raw, method="POST",
        headers={
            "content-type": ctype,
            "x-will-role": "operator",
            "x-will-tenant": TENANT_ID,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            resp.read()
    except Exception as exc:  # pragma: no cover - best effort
        print(f"[bc2a-sim] POST {path} failed: {exc}", file=sys.stderr, flush=True)


def main() -> int:
    stop = False

    def handle(_s, _f):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle)
    signal.signal(signal.SIGINT, handle)

    print(f"[bc2a-sim] ICIS-style replication -> {BASE}", flush=True)
    t0 = time.time()
    while not stop:
        e = time.time() - t0

        # Friendly company, slow patrol box.
        flat, flon = offset(C_LAT, C_LON, 1500 * math.sin(e / 60), 1500 * math.cos(e / 60))
        post("/v1/ingest/jc3iedm", json.dumps({
            "object_item_id": "OI-LF-21",
            "category": "UNIT",
            "name": "Cp 2 Vanatori",
            "hostility": "FR",
            "dimension": "LAND",
            "echelon": "COMPANY",
            "location": {"lat_deg": round(flat, 6), "lon_deg": round(flon, 6), "elevation_m": 480},
            "reporting_org": "JFC",
            "reported_at": iso(),
            "classification": "RS",
        }).encode("utf-8"), "application/json")

        # Unknown contact transiting.
        ulat, ulon = offset(C_LAT, C_LON, 4000, 6000 - (e * 25) % 12000)
        post("/v1/ingest/jc3iedm", json.dumps({
            "object_item_id": "OI-UNK-77",
            "category": "EQUIPMENT",
            "name": "Unknown vehicle",
            "hostility": "UK",
            "dimension": "LAND",
            "location": {"lat_deg": round(ulat, 6), "lon_deg": round(ulon, 6), "elevation_m": 470},
            "reporting_org": "BN-RECCE",
            "reported_at": iso(),
            "classification": "NU",
        }).encode("utf-8"), "application/json")

        # AdatP-3 TRACKREP for a friendly recce element.
        rlat, rlon = offset(C_LAT, C_LON, -1200, 1200 * math.cos(e / 45))
        adatp3 = (
            "MSGID/TRACKREP/WILL//\n"
            "TRACKNO/TN-RECCE-3//\n"
            "AMPN/CERCETAS-3//\n"
            f"POSIT/{rlat:.6f}/{rlon:.6f}/465.0//\n"
            "IDENT/FR/LAND//\n"
            "CLASS/NU//\n"
            f"TIMEPOS/{iso()}//\n"
        )
        post("/v1/ingest/adatp3", adatp3.encode("utf-8"), "text/plain")

        # Southbound backwards-compat render of the unknown contact (the
        # ICIS gateway would loop this back into BC2A clients).
        post("/v1/southbound/render", json.dumps({
            "external_id": "OI-UNK-77",
            "callsign": "Unknown vehicle",
            "hostility": "UK",
            "dimension": "LAND",
            "lat": round(ulat, 6),
            "lon": round(ulon, 6),
            "classification": "NESECRET",
        }).encode("utf-8"), "application/json")

        time.sleep(PERIOD_S)
    return 0


if __name__ == "__main__":
    sys.exit(main())
