-- Sprint 2 — S2-01 — multi-tenant foundation.
-- ADR-006 (forthcoming) ratifies the per-tenant DB-isolation policy at scale;
-- Sprint 2 ships shared-DB / tenant-column isolation, sufficient for the
-- white-label admin use case. Per-tenant DB compartments arrive in Sprint 3.

CREATE TABLE IF NOT EXISTS tenants (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug         TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    theme        JSONB NOT NULL DEFAULT '{}'::jsonb,
    features     JSONB NOT NULL DEFAULT '{}'::jsonb,
    terminology  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenants_slug_idx ON tenants (slug);

-- Seed the default tenant referenced by Sprint 0 / Sprint 1 plugins so the
-- tenant_id UUID 00000000-0000-0000-0000-000000000001 maps to a live row.
INSERT INTO tenants (id, slug, display_name, theme)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'default',
    'WILL Romania (default)',
    jsonb_build_object(
        'primaryColor', '#3273dc',
        'logoUrl', '',
        'bannerLabel', 'NESECRET'
    )
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION tenants_set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenants_touch_updated_at ON tenants;
CREATE TRIGGER tenants_touch_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION tenants_set_updated_at();

COMMENT ON COLUMN tenants.theme IS
    'White-label theme: primaryColor, logoUrl, bannerLabel, optional trackIcons override map.';
COMMENT ON COLUMN tenants.terminology IS
    'Per-tenant terminology overrides (e.g., {"sensor":"asset"}); applied client-side.';
COMMENT ON COLUMN tenants.features IS
    'Feature toggles, e.g., {"ai_prediction":false,"link22":false}. Sprint 2 stub.';
