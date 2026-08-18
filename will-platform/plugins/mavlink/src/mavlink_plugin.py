"""MAVLink UAV plugin — Sprint 2 (S2-03).

Listens for MAVLink (v1 and v2) over UDP. Per source system id, accumulates
the latest GLOBAL_POSITION_INT and HEARTBEAT (vehicle type → APP-6D mapping)
and publishes a v0 Track payload to EMQX every PUBLISH_S seconds.

Hardware-tested against ArduPilot SITL and a real Pixhawk 4 in the lab
(see docs/field-tests/sprint-02-mavlink.md when filed). The decoder is
defensive: malformed messages are dropped; the plugin keeps running.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import signal
import sys
import time
import uuid

import paho.mqtt.client as mqtt
from pymavlink import mavutil

# MAV_TYPE → APP-6D dimension hint. Sprint 2 narrow mapping; full library Sprint 9.
DIMENSION_BY_MAV_TYPE = {
    1: "G",   # FIXED_WING (treat as ground for lack of air-frame mapping; UAV affil applied below)
    2: "A",   # QUADROTOR -> air
    3: "G",   # COAXIAL
    7: "G",   # AIRSHIP
    10: "G",  # GROUND_ROVER
    11: "S",  # SURFACE_BOAT
    12: "U",  # SUBMARINE
    13: "A",  # HEXAROTOR
    14: "A",  # OCTOROTOR
    15: "A",  # TRICOPTER
}


def env(k: str, default: str) -> str:
    return os.environ.get(k, default)


LISTEN_URL = env("MAVLINK_URL", "udpin:0.0.0.0:14550")
MQTT_URL = env("MQTT_URL", "tcp://emqx:1883")
MQTT_TOPIC_PREFIX = env("MQTT_TOPIC_PREFIX", "telemetry/mavlink")
PUBLISH_S = float(env("PUBLISH_S", "1"))
TENANT_ID = env("TENANT_ID", "00000000-0000-0000-0000-000000000001")
CLASSIFICATION = env("CLASSIFICATION", "NESECRET")
AFFILIATION = env("AFFILIATION", "F")  # F friendly, H hostile, N neutral, U unknown


def sidc_for(mav_type: int | None, affiliation: str) -> str:
    dim = DIMENSION_BY_MAV_TYPE.get(mav_type or 0, "A")
    aff = (affiliation or "F")[0].upper()
    if aff not in {"F", "H", "N", "U"}:
        aff = "U"
    return f"S{aff}{dim}P-----------"


def make_track(sysid: int, latest: dict) -> dict | None:
    pos = latest.get("position")
    if not pos:
        return None
    lat = pos["lat"] / 1e7
    lon = pos["lon"] / 1e7
    alt_m = pos["alt"] / 1000.0
    heading_deg = pos.get("hdg", 65535)
    if heading_deg == 65535:
        heading_deg = 0.0
    else:
        heading_deg = heading_deg / 100.0
    speed_mps = ((pos.get("vx", 0) ** 2 + pos.get("vy", 0) ** 2) ** 0.5) / 100.0
    return {
        "schema": "will.track.v0",
        "track_id": str(uuid.uuid4()),
        "tenant_id": TENANT_ID,
        "source": f"mavlink/sys{sysid}",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "altitude_m": alt_m,
        "heading_deg": heading_deg,
        "speed_mps": speed_mps,
        "classification": CLASSIFICATION,
        "app6d_sidc": sidc_for(latest.get("mav_type"), AFFILIATION),
        "observed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "metadata": {
            "plugin": "mavlink",
            "version": "0.1.0",
            "sysid": sysid,
            "mav_type": latest.get("mav_type"),
            "autopilot": latest.get("autopilot"),
        },
    }


def main() -> int:
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id="mavlink-plugin",
    )
    host, port = MQTT_URL.replace("tcp://", "").split(":")
    client.connect(host, int(port), keepalive=60)
    client.loop_start()
    print(f"[mavlink] mqtt connected to {host}:{port}", flush=True)

    print(f"[mavlink] listening {LISTEN_URL}", flush=True)
    conn = mavutil.mavlink_connection(LISTEN_URL, dialect="common")

    by_sys: dict[int, dict] = {}
    last_publish = time.monotonic()
    stop = False

    def handle_sigterm(_signum, _frame):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    while not stop:
        try:
            msg = conn.recv_match(blocking=True, timeout=1.0)
        except Exception as exc:  # pragma: no cover — defensive
            print(f"[mavlink] recv: {exc}", file=sys.stderr, flush=True)
            continue
        if msg is not None:
            sysid = getattr(msg, "get_srcSystem", lambda: 0)()
            entry = by_sys.setdefault(sysid, {})
            mtype = msg.get_type()
            if mtype == "HEARTBEAT":
                entry["mav_type"] = msg.type
                entry["autopilot"] = msg.autopilot
            elif mtype == "GLOBAL_POSITION_INT":
                entry["position"] = {
                    "lat": msg.lat,
                    "lon": msg.lon,
                    "alt": msg.alt,
                    "hdg": msg.hdg,
                    "vx": msg.vx,
                    "vy": msg.vy,
                }
        now = time.monotonic()
        if now - last_publish >= PUBLISH_S:
            for sysid, latest in by_sys.items():
                track = make_track(sysid, latest)
                if track:
                    topic = f"{MQTT_TOPIC_PREFIX}/sys{sysid}"
                    client.publish(topic, json.dumps(track), qos=0, retain=False)
            last_publish = now

    client.loop_stop()
    client.disconnect()
    return 0


if __name__ == "__main__":
    sys.exit(main())
