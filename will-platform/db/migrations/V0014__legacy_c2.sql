-- Legacy C2 Bridge (BC2A / ICIS interoperability). ADR-014.
-- Northbound: JC3IEDM / AdatP-3 -> canonical tracks (BC2A as a sensor
-- source). Southbound: canonical -> MIL-STD-2525D + AdatP-3 for backwards
-- compatibility. WILL never writes BC2A's DB; tenant-scoped; RLS.

CREATE TABLE IF NOT EXISTS legacy_tracks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT NOT NULL,                 -- JC3IEDM object-item id / AdatP-3 track no
    source_format   TEXT NOT NULL CHECK (source_format IN ('jc3iedm','adatp3')),
    callsign        TEXT NOT NULL DEFAULT '',
    hostility       TEXT NOT NULL DEFAULT 'UK',    -- FR|HO|NE|UK|SU|AF
    dimension       TEXT NOT NULL DEFAULT 'LAND',  -- LAND|AIR|SEA_SURFACE|SUBSURFACE|SPACE
    lat             DOUBLE PRECISION NOT NULL,
    lon             DOUBLE PRECISION NOT NULL,
    altitude_m      DOUBLE PRECISION NOT NULL DEFAULT 0,
    app6_sidc       TEXT NOT NULL DEFAULT 'SUGP-----------',
    classification  TEXT NOT NULL DEFAULT 'NESECRET',
    observed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, external_id)
);
CREATE INDEX IF NOT EXISTS legacy_tracks_tenant ON legacy_tracks (tenant_id, source_format);

-- Southbound: messages WILL renders for injection back into BC2A loops by
-- the customer's ICIS gateway. Display/backwards-compat only.
CREATE TABLE IF NOT EXISTS southbound_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    track_external_id TEXT NOT NULL,
    app6_sidc       TEXT NOT NULL,
    adatp3          TEXT NOT NULL,                 -- rendered AdatP-3 track report
    classification  TEXT NOT NULL DEFAULT 'NESECRET',
    rendered_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS southbound_tenant ON southbound_messages (tenant_id, rendered_at DESC);

ALTER TABLE legacy_tracks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE southbound_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY legacy_tracks_tenant_isolation ON legacy_tracks
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY legacy_tracks_service_bypass ON legacy_tracks
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');

CREATE POLICY southbound_tenant_isolation ON southbound_messages
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY southbound_service_bypass ON southbound_messages
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');

COMMENT ON TABLE legacy_tracks IS
    'BC2A/ICIS treated as a sensor source. ADR-014. WILL never writes the BC2A DB.';
