-- Post-Sprint-5 — Battle Management module. ADR-008.

CREATE TABLE IF NOT EXISTS effectors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT NOT NULL,
    plugin_id       TEXT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN (
        'sam_area','sam_point','nsm_coastal','jammer_rf','c_uas','other'
    )),
    display_name    TEXT NOT NULL,
    classification  TEXT NOT NULL DEFAULT 'NESECRET',
    lat             DOUBLE PRECISION,
    lon             DOUBLE PRECISION,
    min_range_m     DOUBLE PRECISION,
    max_range_m     DOUBLE PRECISION,
    min_altitude_m  DOUBLE PRECISION,
    max_altitude_m  DOUBLE PRECISION,
    max_target_speed_mps DOUBLE PRECISION,
    rounds_remaining INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'READY'
        CHECK (status IN ('READY','ENGAGING','RELOADING','MAINTENANCE','OFFLINE')),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, external_id)
);

CREATE INDEX IF NOT EXISTS effectors_tenant_kind ON effectors (tenant_id, kind);

-- Threats are a *view* over tracks plus the scoring annotation. We persist
-- them so the engagement queue has a stable foreign key target even if the
-- underlying track is dropped.
CREATE TABLE IF NOT EXISTS threats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    track_id        TEXT NOT NULL,
    threat_class    TEXT NOT NULL
        CHECK (threat_class IN ('cruise','ballistic','uav_one_way','aircraft','surface','swarm','unknown')),
    classification  TEXT NOT NULL DEFAULT 'NESECRET',
    priority_score  DOUBLE PRECISION NOT NULL,
    rationale       JSONB NOT NULL DEFAULT '{}'::jsonb,
    observed_lat    DOUBLE PRECISION,
    observed_lon    DOUBLE PRECISION,
    observed_speed_mps DOUBLE PRECISION,
    observed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS threats_tenant_priority ON threats (tenant_id, priority_score DESC);
CREATE INDEX IF NOT EXISTS threats_tenant_track ON threats (tenant_id, track_id);

CREATE TABLE IF NOT EXISTS engagements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    threat_id       UUID NOT NULL REFERENCES threats(id) ON DELETE CASCADE,
    effector_id     UUID NOT NULL REFERENCES effectors(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'PROPOSED'
        CHECK (status IN ('PROPOSED','APPROVED','EXECUTING','COMPLETED','ABORTED','REJECTED')),
    probability_of_kill DOUBLE PRECISION,
    time_to_intercept_s DOUBLE PRECISION,
    proposed_by     UUID,
    approved_by     UUID,
    proposed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at     TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    notes           TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS engagements_tenant_status ON engagements (tenant_id, status, proposed_at DESC);

-- RLS in the same shape as ADR-006.
ALTER TABLE effectors   ENABLE ROW LEVEL SECURITY;
ALTER TABLE threats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY effectors_tenant_isolation ON effectors
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY effectors_service_bypass ON effectors
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');

CREATE POLICY threats_tenant_isolation ON threats
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY threats_service_bypass ON threats
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');

CREATE POLICY engagements_tenant_isolation ON engagements
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY engagements_service_bypass ON engagements
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');

COMMENT ON COLUMN threats.priority_score IS
    '0..1. Higher = more urgent. Methodology in docs/bms/threat-scoring.md.';
COMMENT ON TABLE engagements IS
    'WILL is a coordinator. Status transitions: PROPOSED → APPROVED → EXECUTING → COMPLETED/ABORTED/REJECTED. ADR-008.';
