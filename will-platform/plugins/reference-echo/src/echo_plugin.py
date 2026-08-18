"""Reference echo plugin (Sprint 1, S1-02).

The smallest possible implementation of the will.sensor.v1.SensorPlugin
contract. Demonstrates Describe/Health/Configure/Telemetry shapes for
plugin authors. Telemetry emits a single canned track at a fixed cadence
so the loader's pipeline can be exercised end-to-end without any external
hardware.

Once the gRPC stubs are generated from contracts/proto, this module imports
them directly. Until then we hand-roll the message shapes so the file is
runnable in the Sprint 1 dev environment without a build step.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import signal
import sys
import time
import uuid
from concurrent import futures

# Sprint 1 placeholder — when stubs arrive, replace the JSON shape with the
# real protobuf messages and serve over gRPC. The contract is intentionally
# the same: Describe / Health / Configure / Telemetry.

CONTRACT_VERSION = "v1.0"
NAME = "reference-echo"
VERSION = "0.1.0"
VENDOR = "WILL Romania"
DESCRIPTION = "Reference plugin for SDK authors. Emits one canned track per second."


def describe() -> dict:
    return {
        "name": NAME,
        "version": VERSION,
        "vendor": VENDOR,
        "contract_version": CONTRACT_VERSION,
        "capabilities": ["sensor.track"],
        "description": DESCRIPTION,
    }


def health() -> dict:
    return {
        "status": "SERVING",
        "message": "ok",
        "checked_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }


def configure(_settings: dict) -> dict:
    return {"accepted": True, "rejected_keys": [], "message": "ok"}


def telemetry_track(tenant_id: str, classification: str) -> dict:
    return {
        "schema": "will.track.v0",
        "track_id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "source": f"{NAME}/canned-1",
        "geometry": {"type": "Point", "coordinates": [26.1025, 44.4268]},  # Bucharest
        "altitude_m": 90.0,
        "heading_deg": 0.0,
        "speed_mps": 0.0,
        "classification": classification,
        "app6d_sidc": "SFGP-----------",
        "observed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "metadata": {"plugin": NAME, "version": VERSION},
    }


def main() -> int:
    tenant_id = os.environ.get("TENANT_ID", "00000000-0000-0000-0000-000000000001")
    classification = os.environ.get("CLASSIFICATION", "NESECRET")
    period_s = float(os.environ.get("PERIOD_S", "1"))

    print(json.dumps({"event": "describe", "data": describe()}), flush=True)
    print(json.dumps({"event": "health", "data": health()}), flush=True)
    print(json.dumps({"event": "configure", "data": configure({})}), flush=True)

    stop = False

    def handle_sigterm(_signum, _frame):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    # Sprint 1: telemetry to stdout for plugin-author visibility. The wired
    # gRPC service streams Track messages to the loader once stubs arrive.
    while not stop:
        track = telemetry_track(tenant_id, classification)
        print(json.dumps({"event": "telemetry", "data": track}), flush=True)
        time.sleep(period_s)
    return 0


if __name__ == "__main__":
    futures.ThreadPoolExecutor(max_workers=1)  # placeholder for future gRPC server pool
    sys.exit(main())
