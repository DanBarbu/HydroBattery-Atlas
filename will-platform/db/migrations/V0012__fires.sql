-- Fires Coordination Measure awareness. ADR-012. READ-ONLY w.r.t. fires.
-- Data flow is one-way: authoritative fires C2 (AFATDS-class) -> WILL.
-- There is deliberately NO schema for fire missions, tasking, or firing
-- solutions. Only coordination measures and fire-mission STATUS.

CREATE TABLE IF NOT EXISTS fscm (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT NOT NULL,
    measure_type    TEXT NOT NULL CHECK (measure_type IN (
        'NFA','RFA','FFA','CFL','FSCL','RFL','ACA','MFP'
    )),
    name            TEXT NOT NULL,
    geometry        JSONB NOT NULL,            -- GeoJSON Polygon or LineString
    min_alt_m       DOUBLE PRECISION,          -- ACA altitude band (nullable)
    max_alt_m       DOUBLE PRECISION,
    effective_from  TIMESTAMPTZ,
    effective_to    TIMESTAMPTZ,
    source          TEXT NOT NULL DEFAULT 'afatds',
    classification  TEXT NOT NULL DEFAULT 'NESECRET',
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, external_id)
);
CREATE INDEX IF NOT EXISTS fscm_tenant_type ON fscm (tenant_id, measure_type);

-- Fire-mission STATUS only — awareness for deconfliction. No targets-as-
-- tasking, no solution data. firing_unit is a free-text label for display.
CREATE TABLE IF NOT EXISTS fire_mission_status (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN (
        'PLANNED','IN_PROGRESS','SHOT','SPLASH','COMPLETE','CANCELLED'
    )),
    target_lat      DOUBLE PRECISION,
    target_lon      DOUBLE PRECISION,
    aca_ref         TEXT,                      -- references fscm.external_id of an ACA
    firing_unit     TEXT NOT NULL DEFAULT '',  -- display label only
    eta_splash      TIMESTAMPTZ,
    source          TEXT NOT NULL DEFAULT 'afatds',
    classification  TEXT NOT NULL DEFAULT 'NESECRET',
    observed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, external_id)
);
CREATE INDEX IF NOT EXISTS fms_tenant_status ON fire_mission_status (tenant_id, status, observed_at DESC);

ALTER TABLE fscm                ENABLE ROW LEVEL SECURITY;
ALTER TABLE fire_mission_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY fscm_tenant_isolation ON fscm
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY fscm_service_bypass ON fscm
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');

CREATE POLICY fms_tenant_isolation ON fire_mission_status
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY fms_service_bypass ON fire_mission_status
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');

COMMENT ON TABLE fire_mission_status IS
    'Fire-mission STATUS for deconfliction awareness only. ADR-012. No tasking, no solutions, one-way from the authoritative fires C2.';
