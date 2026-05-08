"""LoRa simulator — Sprint 4 (S4-05).

Publishes synthetic LoRaWAN-style uplink JSON for COUNT virtual nodes
scattered around the Cincu range. Each node sends a position once per
PERIOD_S seconds. Used for the 100-node E2E ingest test and the
"Brigada Demo" (S4-06) bulk-sensor scenario.
"""
from __future__ import annotations

import json
import math
import os
import random
import signal
import sys
import time

import paho.mqtt.client as mqtt

UPSTREAM_URL = os.environ.get("UPSTREAM_MQTT_URL", "tcp://emqx:1883")
TOPIC_PREFIX = os.environ.get("TOPIC_PREFIX", "lorawan")
COUNT = int(os.environ.get("COUNT", "100"))
PERIOD_S = float(os.environ.get("PERIOD_S", "5"))

CENTER_LAT = 45.8696
CENTER_LON = 24.7753
SPREAD_KM = float(os.environ.get("SPREAD_KM", "8"))


def _scatter(n: int, seed: int = 4607) -> list[tuple[str, float, float]]:
    rng = random.Random(seed)
    out: list[tuple[str, float, float]] = []
    for i in range(n):
        # Deterministic spread so every run picks the same locations.
        angle = rng.uniform(0, 2 * math.pi)
        radius_km = rng.uniform(0.2, SPREAD_KM)
        north_m = math.sin(angle) * radius_km * 1000
        east_m = math.cos(angle) * radius_km * 1000
        dlat = (north_m / 6_378_137.0) * (180 / math.pi)
        dlon = (east_m / (6_378_137.0 * math.cos(math.radians(CENTER_LAT)))) * (180 / math.pi)
        out.append((f"sim-node-{i:03d}", CENTER_LAT + dlat, CENTER_LON + dlon))
    return out


def main() -> int:
    host, port = UPSTREAM_URL.replace("tcp://", "").split(":")
    client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2, client_id="lora-sim")
    client.connect(host, int(port), keepalive=60)
    client.loop_start()
    print(f"[lora-sim] published {COUNT} synthetic nodes to {UPSTREAM_URL}/{TOPIC_PREFIX}/...", flush=True)

    nodes = _scatter(COUNT)
    fcnt = 0
    stop = False

    def handle_sigterm(_s, _f):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    while not stop:
        fcnt += 1
        for dev, lat, lon in nodes:
            payload = {"devEUI": dev, "fCnt": fcnt, "lat": lat, "lon": lon, "alt": 480.0}
            client.publish(f"{TOPIC_PREFIX}/{dev}/uplink", json.dumps(payload), qos=0, retain=False)
        time.sleep(PERIOD_S)

    client.loop_stop()
    client.disconnect()
    return 0


if __name__ == "__main__":
    sys.exit(main())
