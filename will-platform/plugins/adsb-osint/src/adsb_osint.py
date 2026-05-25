"""ADS-B OSINT plugin — civilian air picture. ADR-016.

Emits canonical will.track.v0 onto a dedicated OSINT topic
(`telemetry/osint/adsb` by default), with every track marked
`metadata.osint = true`, `metadata.confidence = "low"`, and STANAG-4774
classification `NESECRET // OSINT`. The frontend renders OSINT as its own
layer; fusion excludes osint=true from default trusted-track correlation
(ADR-016).

Modes:
  - MODE=sim (default): synthetic ADS-B-shaped feed over a configurable
    bounding box (default Romania + western Black Sea). Lab/air-gap safe.
  - MODE=opensky: poll the OpenSky Network public REST endpoint
    `/api/states/all` for state vectors inside the bbox.

Boundary (ADR-016):
  - No active reconnaissance, ever. This plugin only consumes broadcast
    or polled public data; it never probes.
  - No auto-promotion: this is advisory context for the operator.
  - Lawful basis: OpenSky's Terms of Use permit research/non-commercial
    use; check before enabling MODE=opensky in production. Document the
    legal basis per deployment in the tenant's data-processing record.
"""
from __future__ import annotations

import json
import math
import os
import random
import signal
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Iterable
from urllib import request as urlrequest

import paho.mqtt.client as mqtt


def env(name: str, default: str) -> str:
    return os.environ.get(name, default)


MODE = env("MODE", "sim").lower()  # sim | opensky
MQTT_HOST = env("MQTT_HOST", "emqx")
MQTT_PORT = int(env("MQTT_PORT", "1883"))
MQTT_TOPIC = env("MQTT_TOPIC", "telemetry/osint/adsb")
TENANT_ID = env("TENANT_ID", "00000000-0000-0000-0000-000000000001")
CLASSIFICATION = env("CLASSIFICATION", "NESECRET // OSINT")
PUBLISH_HZ = float(env("PUBLISH_HZ", "1"))

# Bbox: south, north, west, east. Default ~ Romania + western Black Sea.
BBOX_S = float(env("BBOX_SOUTH", "43.5"))
BBOX_N = float(env("BBOX_NORTH", "48.3"))
BBOX_W = float(env("BBOX_WEST", "20.0"))
BBOX_E = float(env("BBOX_EAST", "30.5"))

# Sim params (only when MODE=sim).
SIM_AIRCRAFT = int(env("SIM_AIRCRAFT", "12"))
SIM_SEED = int(env("SIM_SEED", "0"))

# Polite OpenSky polling. Their unauthenticated rate cap is ~10 s; we use 15.
OPENSKY_PERIOD_S = float(env("OPENSKY_PERIOD_S", "15"))
OPENSKY_URL = (
    f"https://opensky-network.org/api/states/all"
    f"?lamin={BBOX_S}&lamax={BBOX_N}&lomin={BBOX_W}&lomax={BBOX_E}"
)


def _track_payload(*, icao24: str, callsign: str, lat: float, lon: float,
                   alt_m: float, heading_deg: float, speed_mps: float,
                   on_ground: bool) -> dict:
    """Build a will.track.v0 envelope with the OSINT discipline markers."""
    return {
        "schema": "will.track.v0",
        "track_id": f"adsb-{icao24}",
        "tenant_id": TENANT_ID,
        # `source` is the OSINT-scoped identifier; matches ADR-016's
        # `source = osint/<plugin>` convention so the UI + fusion can route
        # on prefix alone.
        "source": f"osint/adsb/{icao24}",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "altitude_m": alt_m,
        "heading_deg": heading_deg,
        "speed_mps": speed_mps,
        "classification": CLASSIFICATION,
        # APP-6D civil-aircraft SIDC (friend-civil air). Operator may override
        # if local doctrine requires a different affiliation for OSINT air.
        "app6d_sidc": "SFAPCF--------",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "metadata": {
            "plugin": "adsb-osint",
            "version": "0.1.0",
            "osint": True,
            "confidence": "low",
            "callsign": callsign,
            "icao24": icao24,
            "on_ground": on_ground,
            "mode": MODE,
        },
    }


# --- sim mode ---------------------------------------------------------------

def _sim_fleet(rng: random.Random) -> list[dict]:
    """Stable synthetic fleet over the bbox, each with a great-circle leg."""
    callsigns = ["TAR721", "WZZ4231", "RYR9TX", "BAW452", "DLH1AP",
                 "AFR1234", "AUA821", "TVS6021", "BLA88H", "ENT55K",
                 "ROT215", "ROT302"]
    fleet = []
    for i in range(SIM_AIRCRAFT):
        icao24 = f"{rng.randint(0x100000, 0xFFFFFF):06x}"
        lat0 = rng.uniform(BBOX_S + 0.2, BBOX_N - 0.2)
        lon0 = rng.uniform(BBOX_W + 0.2, BBOX_E - 0.2)
        heading = rng.uniform(0, 360)
        fleet.append({
            "icao24": icao24,
            "callsign": callsigns[i % len(callsigns)],
            "lat": lat0, "lon": lon0,
            "alt_m": rng.uniform(2500, 12500),
            "heading_deg": heading,
            "speed_mps": rng.uniform(180, 260),
        })
    return fleet


def _advance(ac: dict, dt_s: float) -> None:
    """Move one aircraft along its heading at its speed; wrap inside bbox."""
    bearing_rad = math.radians(ac["heading_deg"])
    dist_m = ac["speed_mps"] * dt_s
    dlat_deg = (dist_m * math.cos(bearing_rad)) / 111_320.0
    coslat = max(abs(math.cos(math.radians(ac["lat"]))), 1e-6)
    dlon_deg = (dist_m * math.sin(bearing_rad)) / (111_320.0 * coslat)
    ac["lat"] += dlat_deg
    ac["lon"] += dlon_deg
    # Reflect off bbox edges so the demo fleet stays in view.
    if ac["lat"] < BBOX_S or ac["lat"] > BBOX_N:
        ac["heading_deg"] = (180 - ac["heading_deg"]) % 360
        ac["lat"] = min(max(ac["lat"], BBOX_S), BBOX_N)
    if ac["lon"] < BBOX_W or ac["lon"] > BBOX_E:
        ac["heading_deg"] = (360 - ac["heading_deg"]) % 360
        ac["lon"] = min(max(ac["lon"], BBOX_W), BBOX_E)


def _sim_iter(rng: random.Random) -> Iterable[dict]:
    fleet = _sim_fleet(rng)
    period = 1.0 / PUBLISH_HZ
    last = time.time()
    while True:
        now = time.time()
        dt = now - last
        last = now
        for ac in fleet:
            _advance(ac, dt)
            yield _track_payload(
                icao24=ac["icao24"], callsign=ac["callsign"],
                lat=ac["lat"], lon=ac["lon"], alt_m=ac["alt_m"],
                heading_deg=ac["heading_deg"], speed_mps=ac["speed_mps"],
                on_ground=False,
            )
        time.sleep(period)


# --- opensky mode -----------------------------------------------------------

def _opensky_iter() -> Iterable[dict]:
    """Poll OpenSky public REST for state vectors inside the bbox."""
    while True:
        try:
            req = urlrequest.Request(OPENSKY_URL, headers={
                "User-Agent": "WILL-adsb-osint/0.1 (+ADR-016)",
            })
            with urlrequest.urlopen(req, timeout=10) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # pragma: no cover - best effort
            print(f"[adsb-osint] opensky fetch failed: {exc}",
                  file=sys.stderr, flush=True)
            time.sleep(OPENSKY_PERIOD_S)
            continue

        for s in payload.get("states") or []:
            # OpenSky state-vector field order is documented and stable.
            icao24 = (s[0] or "").strip().lower()
            callsign = (s[1] or "").strip()
            lon, lat = s[5], s[6]
            on_ground = bool(s[8])
            velocity_mps = s[9] or 0.0
            heading_deg = s[10] or 0.0
            geo_alt_m = s[13] if s[13] is not None else (s[7] or 0.0)
            if icao24 == "" or lat is None or lon is None:
                continue
            yield _track_payload(
                icao24=icao24, callsign=callsign or icao24,
                lat=lat, lon=lon, alt_m=geo_alt_m or 0.0,
                heading_deg=heading_deg, speed_mps=velocity_mps,
                on_ground=on_ground,
            )
        time.sleep(OPENSKY_PERIOD_S)


def main() -> int:
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"adsb-osint-{uuid.uuid4().hex[:8]}",
    )

    def on_connect(_c, _u, _f, reason_code, _p):
        if reason_code == 0:
            print(f"[adsb-osint] connected to {MQTT_HOST}:{MQTT_PORT} "
                  f"mode={MODE} topic={MQTT_TOPIC}", flush=True)
        else:
            print(f"[adsb-osint] connect failed: {reason_code}",
                  file=sys.stderr, flush=True)

    client.on_connect = on_connect
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_start()

    stop = {"v": False}

    def _handle(_s, _f):
        stop["v"] = True

    signal.signal(signal.SIGTERM, _handle)
    signal.signal(signal.SIGINT, _handle)

    if MODE == "opensky":
        source = _opensky_iter()
    else:
        if MODE != "sim":
            print(f"[adsb-osint] unknown MODE={MODE!r}, falling back to sim",
                  file=sys.stderr, flush=True)
        rng = random.Random(SIM_SEED or None)
        source = _sim_iter(rng)

    try:
        for track in source:
            if stop["v"]:
                break
            client.publish(MQTT_TOPIC, json.dumps(track), qos=0, retain=False)
    finally:
        client.loop_stop()
        client.disconnect()
    return 0


if __name__ == "__main__":
    sys.exit(main())
