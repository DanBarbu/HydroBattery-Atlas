"""Own-ship simulator — Romanian Black Sea surface picture.

Two vessels, posting to the ownship service every PERIOD_S seconds:
  - F-Vânătorul: MMPV 90 corvette (Rheinmetall/NVL, Mangalia). Patrols a
    box off Constanța. Cycles into EMCON SILENT (SATCOM DOWN, HF DEGRADED)
    so the comms-degraded / offline-first picture is visible.
  - P-Bârsa: Hisar-class OPV (ASFAT, TCG Akhisar-derived). Outer patrol,
    comms nominal.

Payloads declared once on first contact (admin-equivalent here for the
demo). WILL integrates the vessel; the vessel CMS owns the vessel fight.
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

BASE = os.environ.get("OWNSHIP_URL", "http://ownship:8086")
PERIOD_S = float(os.environ.get("PERIOD_S", "5"))
TENANT_ID = os.environ.get("TENANT_ID", "00000000-0000-0000-0000-000000000001")

# Constanța approaches.
C_LAT, C_LON = 44.1733, 28.80
EARTH_R = 6_378_137.0


def offset(lat, lon, north_m, east_m):
    dlat = (north_m / EARTH_R) * (180 / math.pi)
    dlon = (east_m / (EARTH_R * math.cos(math.radians(lat)))) * (180 / math.pi)
    return lat + dlat, lon + dlon


def _req(method: str, path: str, body, role: str = "operator"):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={
            "content-type": "application/json",
            "x-will-role": role,
            "x-will-tenant": TENANT_ID,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.read()
    except Exception as exc:  # pragma: no cover - best effort
        print(f"[ownship-sim] {method} {path} failed: {exc}", file=sys.stderr, flush=True)
        return None


def iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


PAYLOADS = {
    "CORVETTE-1": [
        {"name": "3D AESA radar", "kind": "sensor", "payload_type": "3d_radar", "status": "READY"},
        {"name": "Hull sonar", "kind": "sensor", "payload_type": "sonar", "status": "READY"},
        {"name": "NSM launcher", "kind": "effector", "payload_type": "nsm", "status": "READY"},
        {"name": "76 mm gun", "kind": "effector", "payload_type": "naval_gun", "status": "READY"},
        {"name": "CIWS", "kind": "effector", "payload_type": "ciws", "status": "READY"},
        {"name": "Decoy launcher", "kind": "effector", "payload_type": "decoy", "status": "READY"},
    ],
    "OPV-1": [
        {"name": "Surface search radar", "kind": "sensor", "payload_type": "2d_radar", "status": "READY"},
        {"name": "EO/IR director", "kind": "sensor", "payload_type": "eo_ir", "status": "READY"},
        {"name": "57 mm gun", "kind": "effector", "payload_type": "naval_gun", "status": "READY"},
    ],
}


def comms_for(ext: str, silent: bool) -> list[dict]:
    if ext == "CORVETTE-1" and silent:
        return [
            {"channel": "voip", "bearer": "intra-ship", "status": "UP", "latency_ms": 4},
            {"channel": "roip", "bearer": "intra-ship", "status": "UP", "latency_ms": 6},
            {"channel": "hf", "bearer": "HF-ALE", "status": "DEGRADED", "latency_ms": 1800},
            {"channel": "vuhf", "bearer": "Link-line", "status": "UP", "latency_ms": 40},
            {"channel": "satcom", "bearer": "Ka", "status": "DOWN", "latency_ms": 0},
        ]
    return [
        {"channel": "voip", "bearer": "intra-ship", "status": "UP", "latency_ms": 4},
        {"channel": "roip", "bearer": "intra-ship", "status": "UP", "latency_ms": 6},
        {"channel": "hf", "bearer": "HF-ALE", "status": "UP", "latency_ms": 900},
        {"channel": "vuhf", "bearer": "Link-line", "status": "UP", "latency_ms": 35},
        {"channel": "satcom", "bearer": "Ka", "status": "UP", "latency_ms": 620},
    ]


def main() -> int:
    stop = False

    def handle(_s, _f):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle)
    signal.signal(signal.SIGINT, handle)

    declared: set[str] = set()
    print(f"[ownship-sim] posting to {BASE}", flush=True)
    t0 = time.time()
    while not stop:
        elapsed = time.time() - t0
        # Corvette EMCON SILENT for a ~40 s window every ~120 s.
        silent = (int(elapsed) % 120) > 80

        # Corvette: inner patrol box off Constanța.
        theta_c = (elapsed / 240.0) * 2 * math.pi
        clat, clon = offset(C_LAT, C_LON, 9_000 * math.sin(theta_c), 9_000 * math.cos(theta_c))
        # OPV: wider, slower outer patrol.
        theta_o = (elapsed / 480.0) * 2 * math.pi
        olat, olon = offset(C_LAT, C_LON, 28_000 * math.sin(theta_o), 30_000 * math.cos(theta_o))

        ships = [
            ("CORVETTE-1", "F-Vanatorul", "mmpv_90_corvette", clat, clon,
             (math.degrees(theta_c) + 90) % 360, 9.0,
             "ACTION_STATIONS" if silent else "UNDERWAY",
             "SILENT" if silent else "FULL"),
            ("OPV-1", "P-Barsa", "hisar_opv", olat, olon,
             (math.degrees(theta_o) + 90) % 360, 6.5, "UNDERWAY", "FULL"),
        ]

        for ext, name, hull, lat, lon, hdg, spd, status, emcon in ships:
            raw = _req("POST", "/v1/platforms/state", {
                "external_id": ext, "name": name, "hull_class": hull,
                "lat": round(lat, 6), "lon": round(lon, 6),
                "heading_deg": round(hdg, 1), "speed_mps": spd,
                "status": status, "emcon_state": emcon,
                "classification": "NESECRET", "observed_at": iso(),
            })
            if raw is None:
                continue
            pid = json.loads(raw).get("id")
            if not pid:
                continue
            _req("PUT", f"/v1/platforms/{pid}/comms", comms_for(ext, silent))
            if ext not in declared:
                _req("PUT", f"/v1/platforms/{pid}/payloads", PAYLOADS[ext], role="admin")
                declared.add(ext)

        time.sleep(PERIOD_S)
    return 0


if __name__ == "__main__":
    sys.exit(main())
