#!/usr/bin/env bash
# Sprint 4 — S4-06 — load the Brigada Demo tenant into a running stack.
# Idempotent: re-running upserts the tenant and skips already-registered
# sensors/memberships.

set -euo pipefail

API=${TENANT_API:-http://localhost:8081/v1/tenants}
SEED=${SEED:-$(dirname "$0")/brigada-demo.json}
ROLE_HEADER='X-Will-Role: admin'

if ! command -v jq >/dev/null; then
    echo "jq is required" >&2; exit 1
fi
if ! command -v curl >/dev/null; then
    echo "curl is required" >&2; exit 1
fi

TENANT_BODY=$(jq '.tenant | {slug, display_name, theme, features, terminology}' "$SEED")

# Create tenant. tenant-admin returns 400 if the slug already exists; we
# ignore that and PATCH instead.
echo "[seed] upserting tenant"
CREATE=$(curl -sS -o /tmp/create.out -w "%{http_code}" -X POST "$API" \
    -H "content-type: application/json" -H "$ROLE_HEADER" -d "$TENANT_BODY")
if [ "$CREATE" = "201" ]; then
    TENANT_ID=$(jq -r '.id' /tmp/create.out)
else
    SLUG=$(jq -r '.tenant.slug' "$SEED")
    TENANT_ID=$(curl -sS -H "$ROLE_HEADER" "$API" | jq -r ".[] | select(.slug==\"$SLUG\") | .id")
    if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" = "null" ]; then
        echo "[seed] FAIL: cannot create or find tenant" >&2
        cat /tmp/create.out >&2; exit 1
    fi
    BODY=$(jq '{display_name, theme, features, terminology}' <<<"$(jq '.tenant' "$SEED")")
    curl -sS -X PATCH "$API/$TENANT_ID" \
        -H "content-type: application/json" -H "$ROLE_HEADER" -d "$BODY" >/dev/null
fi
echo "[seed] tenant id: $TENANT_ID"

echo "[seed] bulk-registering sensors"
curl -sS -X POST "$API/$TENANT_ID/sensors" \
    -H "content-type: application/json" -H "$ROLE_HEADER" \
    -d "$(jq '.sensors' "$SEED")" >/dev/null

echo "[seed] granting memberships"
jq -c '.memberships[]' "$SEED" | while read -r m; do
    curl -sS -X POST "$API/$TENANT_ID/members" \
        -H "content-type: application/json" -H "$ROLE_HEADER" -d "$m" >/dev/null || true
done

echo "[seed] done. visit http://localhost:3000 → Admin → '$(jq -r '.tenant.display_name' "$SEED")'"
