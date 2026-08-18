-- Sprint 4 — S4-02 + S4-03 — sensors registry and tenant-scoped RBAC.
-- ADR-006 governs which deployment mode this runs under.
-- NPKI-backed authentication arrives in Sprint 10; Sprint 4 ships the
-- schema and the role catalogue so the admin UI and middleware are real.

CREATE TABLE IF NOT EXISTS users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username     TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    -- Sprint 10 swaps this for NPKI / RO-PKI binding via PKCS#11.
    auth_method  TEXT NOT NULL DEFAULT 'local' CHECK (auth_method IN ('local', 'npki', 'oidc')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE user_role AS ENUM ('viewer', 'operator', 'admin', 'auditor', 'cross_tenant_auditor');

CREATE TABLE IF NOT EXISTS user_tenants (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role       user_role NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by UUID REFERENCES users(id),
    PRIMARY KEY (user_id, tenant_id, role)
);

CREATE INDEX IF NOT EXISTS user_tenants_tenant_idx ON user_tenants (tenant_id);
CREATE INDEX IF NOT EXISTS user_tenants_user_idx   ON user_tenants (user_id);

CREATE TABLE IF NOT EXISTS sensors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id     TEXT NOT NULL,
    family          TEXT NOT NULL CHECK (family IN ('lora', 'gmti', 'cot', 'mavlink', 'other')),
    display_name    TEXT NOT NULL,
    home_lat        DOUBLE PRECISION,
    home_lon        DOUBLE PRECISION,
    classification  TEXT NOT NULL DEFAULT 'NESECRET',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, external_id)
);

CREATE INDEX IF NOT EXISTS sensors_tenant_family ON sensors (tenant_id, family);

-- Seed a couple of stock users so the admin UI has someone to render at
-- first boot. Auth verification arrives in Sprint 10.
INSERT INTO users (id, username, display_name, auth_method) VALUES
    ('00000000-0000-0000-0000-0000000000a1', 'admin',    'Default Admin',   'local'),
    ('00000000-0000-0000-0000-0000000000a2', 'operator', 'Default Operator','local'),
    ('00000000-0000-0000-0000-0000000000a3', 'auditor',  'Default Auditor', 'local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_tenants (user_id, tenant_id, role) VALUES
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'admin'),
    ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000001', 'operator'),
    ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000001', 'auditor')
ON CONFLICT DO NOTHING;
