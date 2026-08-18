-- BFT module — Blue / Friendly Force Tracking. ADR-010.
-- Friendly assets are situational-awareness only: no targeting, no
-- engagement linkage. Tenant-scoped; RLS in the ADR-006 shape.

CREATE TABLE IF NOT EXISTS friendly_assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT NOT NULL,
    callsign        TEXT NOT NULL,
    platform_type   TEXT NOT NULL CHECK (platform_type IN (
        'lynx_kf41','m1a2_abrams','cobra_ii','piranha_iii','piranha_v',
        'f16','f35','watchkeeper','dismounted','naval','other'
    )),
    branch          TEXT NOT NULL CHECK (branch IN ('land','air','naval','sof','joint')),
    echelon         TEXT NOT NULL DEFAULT 'unknown' CHECK (echelon IN (
        'team','squad','platoon','company','battalion','brigade','unknown'
    )),
    lat             DOUBLE PRECISION NOT NULL,
    lon             DOUBLE PRECISION NOT NULL,
    heading_deg     DOUBLE PRECISION NOT NULL DEFAULT 0,
    speed_mps       DOUBLE PRECISION NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'OPERATIONAL' CHECK (status IN (
        'OPERATIONAL','DEGRADED','MAINTENANCE','NO_COMMS','BINGO','WINCHESTER'
    )),
    classification  TEXT NOT NULL DEFAULT 'NESECRET',
    source_format   TEXT NOT NULL DEFAULT 'will_native' CHECK (source_format IN (
        'cot_friendly','nffi','vmf_k05_1','link16_ppli','will_native'
    )),
    last_report_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, external_id)
);

CREATE INDEX IF NOT EXISTS friendly_assets_tenant_branch
    ON friendly_assets (tenant_id, branch);
CREATE INDEX IF NOT EXISTS friendly_assets_tenant_lastreport
    ON friendly_assets (tenant_id, last_report_at DESC);

ALTER TABLE friendly_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY friendly_tenant_isolation ON friendly_assets
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY friendly_service_bypass ON friendly_assets
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');

COMMENT ON TABLE friendly_assets IS
    'Blue/Friendly Force Tracking. ADR-010. Situational awareness only — no targeting linkage.';
COMMENT ON COLUMN friendly_assets.status IS
    'BINGO = minimum-fuel RTB; WINCHESTER = munitions expended. Air-branch states.';
