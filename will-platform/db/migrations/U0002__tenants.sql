DROP TRIGGER IF EXISTS tenants_touch_updated_at ON tenants;
DROP FUNCTION IF EXISTS tenants_set_updated_at;
DROP INDEX IF EXISTS tenants_slug_idx;
DROP TABLE IF EXISTS tenants;
