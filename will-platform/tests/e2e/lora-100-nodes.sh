#!/usr/bin/env bash
# Sprint 4 — S4-05 — E2E test ingesting 100 LoRa nodes.
#
# Subscribes to the MQTT topic the websocket-bridge consumes
# (telemetry/lora/+) and counts distinct `source` values seen within a
# WINDOW_S window. Asserts >= EXPECTED_NODES.
#
# Usage: ./lora-100-nodes.sh
#
# Requirements: mosquitto_sub (apt: mosquitto-clients), jq.
# Run from inside the will-platform/ directory after `docker compose up -d`.

set -euo pipefail

EXPECTED_NODES=${EXPECTED_NODES:-100}
WINDOW_S=${WINDOW_S:-12}        # ~2 lora-sim cycles at PERIOD_S=5
HOST=${HOST:-localhost}
PORT=${PORT:-1883}
TOPIC=${TOPIC:-telemetry/lora/#}
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

echo "[lora-e2e] subscribing to $TOPIC for ${WINDOW_S}s..."
timeout "${WINDOW_S}s" mosquitto_sub -h "$HOST" -p "$PORT" -t "$TOPIC" -v >"$TMP" || true

# mosquitto_sub -v prints "<topic> <payload>" per message; payload is JSON.
DISTINCT=$(awk '{ $1=""; print substr($0,2) }' "$TMP" \
    | jq -r '.source' 2>/dev/null \
    | sort -u | wc -l | tr -d ' ')

echo "[lora-e2e] distinct LoRa sources observed: ${DISTINCT}"

if [ "${DISTINCT}" -lt "${EXPECTED_NODES}" ]; then
    echo "[lora-e2e] FAIL: expected >= ${EXPECTED_NODES}, observed ${DISTINCT}" >&2
    echo "[lora-e2e] last 10 raw payloads:" >&2
    tail -n 10 "$TMP" >&2 || true
    exit 1
fi

echo "[lora-e2e] PASS"
