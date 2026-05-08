-- Sprint 5 — server-side sync state for edge agents.
-- Each edge node has an entry; we record the last sync window and the high-
-- water-mark id of the last accepted track + command from each edge.

CREATE TABLE IF NOT EXISTS edge_nodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    last_seen_at    TIMESTAMPTZ,
    last_track_hwm  BIGINT NOT NULL DEFAULT 0,
    last_cmd_hwm    BIGINT NOT NULL DEFAULT 0,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, external_id)
);

CREATE INDEX IF NOT EXISTS edge_nodes_tenant_idx ON edge_nodes (tenant_id);

-- The commands queue mirrors what the edge outbox produced. Sprint 5 ships
-- a coarse `kind` taxonomy; the operator-action workflow Sprint 6 ships
-- adds richer kinds.
CREATE TABLE IF NOT EXISTS edge_commands (
    id              BIGSERIAL PRIMARY KEY,
    edge_node_id    UUID NOT NULL REFERENCES edge_nodes(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    edge_local_id   BIGINT NOT NULL,
    kind            TEXT NOT NULL,
    payload         JSONB NOT NULL,
    edge_observed_at TIMESTAMPTZ NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (edge_node_id, edge_local_id)
);

CREATE INDEX IF NOT EXISTS edge_commands_tenant_received
    ON edge_commands (tenant_id, received_at DESC);

COMMENT ON COLUMN edge_nodes.last_track_hwm IS
    'High-water-mark id of the last track upload accepted from this edge.';
COMMENT ON COLUMN edge_commands.edge_local_id IS
    'Edge-local outbox id; together with edge_node_id forms the dedup key.';
