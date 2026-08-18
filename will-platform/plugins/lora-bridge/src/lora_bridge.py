"""LoRa MQTT bridge — Sprint 4 (S4-01).

Subscribes to an upstream MQTT topic carrying ChirpStack-style application
events and republishes each device uplink as a v0 Track on the WILL bus.
The decoder is intentionally tolerant: it accepts both ChirpStack v3
(`object` payload) and v4 (`object.gnss`) shapes, plus a minimal WILL-
native shape for the bundled simulator.

Hostile inputs are dropped with one log line; the bridge never crashes.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import signal
import sys
import uuid

import paho.mqtt.client as mqtt


def env(k: str, default: str) -> str:
    return os.environ.get(k, default)


UPSTREAM_URL = env("UPSTREAM_MQTT_URL", "tcp://emqx:1883")
UPSTREAM_TOPIC = env("UPSTREAM_TOPIC", "lorawan/+/uplink")
DOWNSTREAM_URL = env("DOWNSTREAM_MQTT_URL", "tcp://emqx:1883")
DOWNSTREAM_TOPIC_PREFIX = env("DOWNSTREAM_TOPIC_PREFIX", "telemetry/lora")
TENANT_ID = env("TENANT_ID", "00000000-0000-0000-0000-000000000001")
CLASSIFICATION = env("CLASSIFICATION", "NESECRET")


def _coords(payload: dict) -> tuple[float, float] | None:
    """Extract (lon, lat) from any of the supported upstream shapes."""
    # WILL-native shape (used by lora-sim)
    if "lon" in payload and "lat" in payload:
        return float(payload["lon"]), float(payload["lat"])
    obj = payload.get("object") or {}
    # ChirpStack v3 flat shape
    if "longitude" in obj and "latitude" in obj:
        return float(obj["longitude"]), float(obj["latitude"])
    # ChirpStack v4 nested gnss shape
    gnss = obj.get("gnss") or {}
    if "longitude" in gnss and "latitude" in gnss:
        return float(gnss["longitude"]), float(gnss["latitude"])
    # Newer LoRaWAN integration variant
    if "rxInfo" in payload and isinstance(payload["rxInfo"], list) and payload["rxInfo"]:
        loc = payload["rxInfo"][0].get("location")
        if loc and "longitude" in loc and "latitude" in loc:
            return float(loc["longitude"]), float(loc["latitude"])
    return None


def _device_id(payload: dict, topic: str) -> str:
    for k in ("devEUI", "deviceName", "device_id"):
        if k in payload and payload[k]:
            return str(payload[k])
    if "deviceInfo" in payload:
        di = payload["deviceInfo"]
        for k in ("devEui", "deviceName"):
            if k in di and di[k]:
                return str(di[k])
    parts = topic.split("/")
    return parts[1] if len(parts) > 1 else "lora-unknown"


def _normalise(payload: dict, topic: str) -> dict | None:
    coords = _coords(payload)
    if coords is None:
        return None
    lon, lat = coords
    if not (-180 <= lon <= 180 and -90 <= lat <= 90):
        return None
    dev = _device_id(payload, topic)
    return {
        "schema": "will.track.v0",
        "track_id": str(uuid.uuid4()),
        "tenant_id": TENANT_ID,
        "source": f"lora/{dev}",
        "track_kind": "point",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "altitude_m": float(payload.get("alt", 0)),
        "heading_deg": 0.0,
        "speed_mps": 0.0,
        "classification": CLASSIFICATION,
        "app6d_sidc": "SUGP-----------",
        "observed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "metadata": {
            "plugin": "lora-bridge",
            "version": "0.1.0",
            "device_id": dev,
            "fcnt": payload.get("fCnt") or payload.get("fcnt"),
        },
    }


def _connect_mqtt(url: str, client_id: str) -> mqtt.Client:
    host, port = url.replace("tcp://", "").split(":")
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=client_id,
    )
    client.connect(host, int(port), keepalive=60)
    return client


def main() -> int:
    upstream = _connect_mqtt(UPSTREAM_URL, "lora-bridge-up")
    downstream = upstream if UPSTREAM_URL == DOWNSTREAM_URL else _connect_mqtt(DOWNSTREAM_URL, "lora-bridge-down")

    def on_connect(_c, _u, _f, reason_code, _p):
        if reason_code == 0:
            print(f"[lora-bridge] subscribing {UPSTREAM_TOPIC}", flush=True)
        else:
            print(f"[lora-bridge] upstream connect rc={reason_code}", file=sys.stderr, flush=True)

    def on_message(_c, _u, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except Exception as exc:
            print(f"[lora-bridge] bad json on {msg.topic}: {exc}", file=sys.stderr, flush=True)
            return
        track = _normalise(payload, msg.topic)
        if track is None:
            print(f"[lora-bridge] no coords in {msg.topic}; dropped", flush=True)
            return
        topic = f"{DOWNSTREAM_TOPIC_PREFIX}/{track['source'].split('/')[1]}"
        downstream.publish(topic, json.dumps(track), qos=0, retain=False)

    upstream.on_connect = on_connect
    upstream.on_message = on_message
    upstream.subscribe(UPSTREAM_TOPIC, qos=0)
    upstream.loop_start()
    if downstream is not upstream:
        downstream.loop_start()

    stop = False

    def handle_sigterm(_s, _f):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    print(f"[lora-bridge] up={UPSTREAM_URL} down={DOWNSTREAM_URL} prefix={DOWNSTREAM_TOPIC_PREFIX}", flush=True)
    while not stop:
        signal.pause()

    upstream.loop_stop()
    if downstream is not upstream:
        downstream.loop_stop()
    upstream.disconnect()
    if downstream is not upstream:
        downstream.disconnect()
    return 0


if __name__ == "__main__":
    sys.exit(main())
