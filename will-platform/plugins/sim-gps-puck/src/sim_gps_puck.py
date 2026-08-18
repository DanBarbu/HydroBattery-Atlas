"""Simulated GPS puck — Sprint 0 (S0-04).

Publishes a circular trajectory over a configured centre point at PUBLISH_HZ Hz.
Default centre is the Cincu Joint National Training Centre. Payload is the
v0 track schema (`docs/contracts/track-v0.json`); promoted to a gRPC SDK
contract in Sprint 1 (ADR-002).
"""
from __future__ import annotations

import json
import math
import os
import signal
import sys
import time
import uuid
from datetime import datetime, timezone

import paho.mqtt.client as mqtt


def env(name: str, default: str) -> str:
    return os.environ.get(name, default)


MQTT_HOST = env("MQTT_HOST", "emqx")
MQTT_PORT = int(env("MQTT_PORT", "1883"))
MQTT_TOPIC = env("MQTT_TOPIC", "telemetry/gps/sim01")
PUBLISH_HZ = float(env("PUBLISH_HZ", "1"))
CENTER_LAT = float(env("CENTER_LAT", "45.8696"))
CENTER_LON = float(env("CENTER_LON", "24.7753"))
RADIUS_M = float(env("RADIUS_M", "1500"))
CLASSIFICATION = env("CLASSIFICATION", "NESECRET")
SOURCE_ID = env("SOURCE_ID", "sim01")
TENANT_ID = env("TENANT_ID", "00000000-0000-0000-0000-000000000001")

EARTH_R = 6_378_137.0  # WGS-84 equatorial radius, metres


def offset_metres_to_latlon(
    lat: float, lon: float, north_m: float, east_m: float
) -> tuple[float, float]:
    dlat = north_m / EARTH_R
    dlon = east_m / (EARTH_R * math.cos(math.radians(lat)))
    return lat + math.degrees(dlat), lon + math.degrees(dlon)


def main() -> int:
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"sim-gps-puck-{SOURCE_ID}",
    )

    def on_connect(c, _userdata, _flags, reason_code, _props):
        if reason_code == 0:
            print(f"[sim-gps-puck] connected to {MQTT_HOST}:{MQTT_PORT}", flush=True)
        else:
            print(f"[sim-gps-puck] connect failed: {reason_code}", file=sys.stderr)

    client.on_connect = on_connect
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_start()

    stop = False

    def handle_sigterm(_signum, _frame):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    period = 1.0 / PUBLISH_HZ
    angular_speed_rad_per_s = (2 * math.pi) / 60.0  # full circle per minute
    t0 = time.time()

    while not stop:
        elapsed = time.time() - t0
        theta = elapsed * angular_speed_rad_per_s
        north_m = RADIUS_M * math.sin(theta)
        east_m = RADIUS_M * math.cos(theta)
        lat, lon = offset_metres_to_latlon(CENTER_LAT, CENTER_LON, north_m, east_m)
        heading_deg = (math.degrees(theta) + 90.0) % 360.0
        speed_mps = RADIUS_M * angular_speed_rad_per_s

        payload = {
            "schema": "will.track.v0",
            "track_id": str(uuid.uuid4()),
            "tenant_id": TENANT_ID,
            "source": SOURCE_ID,
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "altitude_m": 0.0,
            "heading_deg": heading_deg,
            "speed_mps": speed_mps,
            "classification": CLASSIFICATION,
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {"plugin": "sim-gps-puck", "version": "0.1.0"},
        }
        client.publish(MQTT_TOPIC, json.dumps(payload), qos=0, retain=False)
        time.sleep(period)

    client.loop_stop()
    client.disconnect()
    return 0


if __name__ == "__main__":
    sys.exit(main())
