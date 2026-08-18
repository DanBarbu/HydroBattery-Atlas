DROP POLICY IF EXISTS friendly_service_bypass ON friendly_assets;
DROP POLICY IF EXISTS friendly_tenant_isolation ON friendly_assets;
DROP INDEX IF EXISTS friendly_assets_tenant_lastreport;
DROP INDEX IF EXISTS friendly_assets_tenant_branch;
DROP TABLE IF EXISTS friendly_assets;
