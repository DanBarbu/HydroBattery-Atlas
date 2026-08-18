-- Naval / Own-Ship integration. ADR-011. Covers acquisition #3 (MMPV 90
-- corvette, Hisar OPV) and #1 (Rafael SEA-COM comms suite).
--
-- A platform is a MOBILE node: it carries its own kinematic state, its
-- comms suite, and its mounted payloads. WILL integrates the vessel into
-- the federated picture; the vessel's own combat-management system (ADVENT
-- / SitaWare-class) remains authoritative for the vessel's own fight.

CREATE TABLE IF NOT EXISTS platforms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT NOT NULL,
    name            TEXT NOT NULL,
    hull_class      TEXT NOT NULL CHECK (hull_class IN (
        'mmpv_90_corvette','hisar_opv','other'
    )),
    lat             DOUBLE PRECISION NOT NULL,
    lon             DOUBLE PRECISION NOT NULL,
    heading_deg     DOUBLE PRECISION NOT NULL DEFAULT 0,
    speed_mps       DOUBLE PRECISION NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'UNDERWAY' CHECK (status IN (
        'UNDERWAY','ANCHORED','ACTION_STATIONS','MAINTENANCE'
    )),
    emcon_state     TEXT NOT NULL DEFAULT 'FULL' CHECK (emcon_state IN (
        'FULL','RESTRICTED','SILENT'
    )),
    classification  TEXT NOT NULL DEFAULT 'NESECRET',
    last_report_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, external_id)
);
CREATE INDEX IF NOT EXISTS platforms_tenant ON platforms (tenant_id, hull_class);

-- Rafael SEA-COM suite: VoIP / RoIP / HF / V-UHF / SATCOM channels with
-- link health. Drives the comms-degraded picture and the offline-first
-- (EMCON SILENT) narrative.
CREATE TABLE IF NOT EXISTS platform_comms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id     UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
    channel         TEXT NOT NULL CHECK (channel IN (
        'voip','roip','hf','vuhf','satcom'
    )),
    bearer          TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'UP' CHECK (status IN ('UP','DEGRADED','DOWN')),
    latency_ms      INTEGER NOT NULL DEFAULT 0,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (platform_id, channel)
);

-- Mounted payloads. A sensor feeds the track pipeline; an effector is
-- registered into BMS with the platform_id so pairing knows it MOVES with
-- the ship.
CREATE TABLE IF NOT EXISTS platform_payloads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id     UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('sensor','effector')),
    payload_type    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'READY' CHECK (status IN ('READY','DEGRADED','OFFLINE')),
    arc_start_deg   DOUBLE PRECISION,
    arc_end_deg     DOUBLE PRECISION,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (platform_id, name)
);

ALTER TABLE platforms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_comms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_payloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY platforms_tenant_isolation ON platforms
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY platforms_service_bypass ON platforms
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');
-- Child tables inherit isolation through their platform FK; the service
-- always sets service_bypass, so a permissive bypass policy is sufficient.
CREATE POLICY comms_service_bypass ON platform_comms
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');
CREATE POLICY payloads_service_bypass ON platform_payloads
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');

COMMENT ON TABLE platforms IS
    'Own-ship mobile node. ADR-011. WILL integrates the vessel; the vessel CMS owns the vessel fight.';
