-- METOC module (weather + Lagrangian drift). ADR-015. Advisory only;
-- provider-adapter (wrap any weather/Lagrangian platform). Tenant-scoped; RLS.

CREATE TABLE IF NOT EXISTS metoc_observations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT NOT NULL,
    station         TEXT NOT NULL DEFAULT '',
    lat             DOUBLE PRECISION NOT NULL,
    lon             DOUBLE PRECISION NOT NULL,
    observed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    temp_c          DOUBLE PRECISION,
    dew_c           DOUBLE PRECISION,
    wind_dir_deg    DOUBLE PRECISION,
    wind_speed_mps  DOUBLE PRECISION,
    gust_mps        DOUBLE PRECISION,
    visibility_m    DOUBLE PRECISION,
    ceiling_m       DOUBLE PRECISION,
    qnh_hpa         DOUBLE PRECISION,
    sea_state       INTEGER,                    -- Douglas 0..9
    wave_height_m   DOUBLE PRECISION,
    precip          TEXT NOT NULL DEFAULT 'none' CHECK (precip IN ('none','light','moderate','heavy')),
    source          TEXT NOT NULL DEFAULT 'metar',
    classification  TEXT NOT NULL DEFAULT 'NESECRET',
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, external_id)
);
CREATE INDEX IF NOT EXISTS metoc_obs_tenant ON metoc_observations (tenant_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS metoc_forecasts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lon             DOUBLE PRECISION NOT NULL,
    valid_from      TIMESTAMPTZ NOT NULL,
    valid_to        TIMESTAMPTZ NOT NULL,
    temp_c          DOUBLE PRECISION,
    wind_dir_deg    DOUBLE PRECISION,
    wind_speed_mps  DOUBLE PRECISION,
    gust_mps        DOUBLE PRECISION,
    visibility_m    DOUBLE PRECISION,
    ceiling_m       DOUBLE PRECISION,
    sea_state       INTEGER,
    wave_height_m   DOUBLE PRECISION,
    precip          TEXT NOT NULL DEFAULT 'none',
    source          TEXT NOT NULL DEFAULT 'nwp',
    classification  TEXT NOT NULL DEFAULT 'NESECRET',
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, external_id)
);
CREATE INDEX IF NOT EXISTS metoc_fc_tenant ON metoc_forecasts (tenant_id, valid_from);

-- Wind+current vector samples for Lagrangian advection (the field a
-- Lagrangian platform provides; u=east m/s, v=north m/s).
CREATE TABLE IF NOT EXISTS metoc_flowfield (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lat             DOUBLE PRECISION NOT NULL,
    lon             DOUBLE PRECISION NOT NULL,
    u_east_mps      DOUBLE PRECISION NOT NULL,
    v_north_mps     DOUBLE PRECISION NOT NULL,
    valid_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    source          TEXT NOT NULL DEFAULT 'lagrangian-platform'
);
CREATE INDEX IF NOT EXISTS metoc_flow_tenant ON metoc_flowfield (tenant_id, valid_at DESC);

ALTER TABLE metoc_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE metoc_forecasts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE metoc_flowfield    ENABLE ROW LEVEL SECURITY;

CREATE POLICY metoc_obs_tenant_isolation ON metoc_observations
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY metoc_obs_service_bypass ON metoc_observations
    AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.service_bypass', true) = 'on');
CREATE POLICY metoc_fc_tenant_isolation ON metoc_forecasts
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY metoc_fc_service_bypass ON metoc_forecasts
    AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.service_bypass', true) = 'on');
CREATE POLICY metoc_flow_tenant_isolation ON metoc_flowfield
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY metoc_flow_service_bypass ON metoc_flowfield
    AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.service_bypass', true) = 'on');

COMMENT ON TABLE metoc_flowfield IS
    'Wind+current vectors for Lagrangian drift advection. ADR-015. Advisory only.';
