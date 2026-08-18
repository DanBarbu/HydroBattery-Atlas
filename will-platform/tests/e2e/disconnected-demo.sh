#!/usr/bin/env bash
# Sprint 5 — S5-05 — disconnected demo.
#
# Partitions the edge agent from the core for PARTITION_S seconds, queues
# OPS_DURING_PARTITION commands during the partition, restores connectivity,
# and asserts the outbox drains within DRAIN_TIMEOUT_S.
#
# Requires: docker, jq, curl. Run from the will-platform/ directory after
# `docker compose up -d`.

set -euo pipefail

EDGE_URL=${EDGE_URL:-http://localhost:8090}
PARTITION_S=${PARTITION_S:-30}
OPS_DURING_PARTITION=${OPS_DURING_PARTITION:-25}
DRAIN_TIMEOUT_S=${DRAIN_TIMEOUT_S:-30}
NETWORK=${NETWORK:-will-platform-dev_will-net}
EDGE_CONTAINER=${EDGE_CONTAINER:-will-edge-agent}

echo "[disconnect] confirming edge agent is reachable"
curl -fsS "$EDGE_URL/healthz" >/dev/null

echo "[disconnect] disconnecting $EDGE_CONTAINER from $NETWORK"
docker network disconnect "$NETWORK" "$EDGE_CONTAINER"

echo "[disconnect] queuing $OPS_DURING_PARTITION operator commands during the partition"
for i in $(seq 1 "$OPS_DURING_PARTITION"); do
    curl -fsS -X POST "$EDGE_URL/v1/edge/commands" \
        -H "content-type: application/json" \
        -d "{\"kind\":\"promote-affiliation\",\"target_id\":\"track-$i\",\"payload\":{\"affiliation\":\"F\"},\"observed_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
        >/dev/null
done

PENDING=$(curl -fsS "$EDGE_URL/v1/edge/status" | jq -r '.pending_commands')
if [ "$PENDING" -lt "$OPS_DURING_PARTITION" ]; then
    echo "[disconnect] FAIL: expected >= $OPS_DURING_PARTITION pending, got $PENDING" >&2
    docker network connect "$NETWORK" "$EDGE_CONTAINER" || true
    exit 1
fi
echo "[disconnect] outbox holds $PENDING commands during partition (expected)"

echo "[disconnect] holding partition for ${PARTITION_S}s"
sleep "$PARTITION_S"

echo "[disconnect] restoring connectivity"
docker network connect "$NETWORK" "$EDGE_CONTAINER"

echo "[disconnect] waiting up to ${DRAIN_TIMEOUT_S}s for the outbox to drain"
deadline=$(( $(date +%s) + DRAIN_TIMEOUT_S ))
while [ "$(date +%s)" -lt "$deadline" ]; do
    REM=$(curl -fsS "$EDGE_URL/v1/edge/status" | jq -r '.pending_commands')
    echo "  pending_commands=$REM"
    if [ "$REM" -eq 0 ]; then
        echo "[disconnect] PASS: outbox drained"
        exit 0
    fi
    sleep 2
done

echo "[disconnect] FAIL: outbox did not drain within ${DRAIN_TIMEOUT_S}s" >&2
exit 1
