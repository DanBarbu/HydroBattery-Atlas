-- Post-BMS-MVP — extensions inspired by publicly-documented capabilities of
-- modern battle-management platforms (Sita-Ware, ADVENT, Fortion IBMS, SBMS).
-- See docs/bms/extensions.md for the alignment matrix.

-- 1. Defended Asset List (DAL)
CREATE TABLE IF NOT EXISTS defended_assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lon             DOUBLE PRECISION NOT NULL,
    criticality     INTEGER NOT NULL DEFAULT 1 CHECK (criticality BETWEEN 1 AND 5),
    classification  TEXT NOT NULL DEFAULT 'NESECRET',
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, external_id)
);
CREATE INDEX IF NOT EXISTS defended_assets_tenant ON defended_assets (tenant_id, criticality DESC);

-- 2. Engagement zones (WEZ, HIDACZ, JEZ, etc.). GeoJSON polygon in JSONB
-- keeps the schema lean; PostGIS conversion is a derived view.
CREATE TABLE IF NOT EXISTS engagement_zones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT NOT NULL,
    name            TEXT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('WEZ','HIDACZ','JEZ','MEZ','FEZ','ROZ','OTHER')),
    polygon         JSONB NOT NULL,   -- GeoJSON Polygon
    active_from     TIMESTAMPTZ,
    active_to       TIMESTAMPTZ,
    classification  TEXT NOT NULL DEFAULT 'NESECRET',
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, external_id)
);
CREATE INDEX IF NOT EXISTS engagement_zones_tenant ON engagement_zones (tenant_id, kind);

-- 3. Engagement extensions: TST flag + F2T2EA timeline as JSONB.
ALTER TABLE engagements
    ADD COLUMN IF NOT EXISTS is_tst BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS timeline JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS engagements_tst ON engagements (tenant_id, is_tst) WHERE is_tst;

COMMENT ON COLUMN engagements.timeline IS
    'F2T2EA stamps: {find,fix,track,target,engage,assess: RFC3339}. docs/bms/extensions.md.';

-- 4. PNT and RF environment awareness on tracks AND effectors.
ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS pnt_status TEXT NOT NULL DEFAULT 'NOMINAL'
        CHECK (pnt_status IN ('NOMINAL','DEGRADED','DENIED','SPOOFED_SUSPECTED')),
    ADD COLUMN IF NOT EXISTS rf_environment TEXT NOT NULL DEFAULT 'NOMINAL'
        CHECK (rf_environment IN ('NOMINAL','CONGESTED','JAMMED'));

ALTER TABLE effectors
    ADD COLUMN IF NOT EXISTS pnt_status TEXT NOT NULL DEFAULT 'NOMINAL'
        CHECK (pnt_status IN ('NOMINAL','DEGRADED','DENIED','SPOOFED_SUSPECTED')),
    ADD COLUMN IF NOT EXISTS rf_environment TEXT NOT NULL DEFAULT 'NOMINAL'
        CHECK (rf_environment IN ('NOMINAL','CONGESTED','JAMMED'));

CREATE INDEX IF NOT EXISTS tracks_pnt_status ON tracks (tenant_id, pnt_status) WHERE pnt_status != 'NOMINAL';

-- RLS in the ADR-006 shape.
ALTER TABLE defended_assets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_zones  ENABLE ROW LEVEL SECURITY;

CREATE POLICY dal_tenant_isolation ON defended_assets
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY dal_service_bypass ON defended_assets
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');

CREATE POLICY zones_tenant_isolation ON engagement_zones
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY zones_service_bypass ON engagement_zones
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');
