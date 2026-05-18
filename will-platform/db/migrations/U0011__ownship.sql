DROP POLICY IF EXISTS payloads_service_bypass ON platform_payloads;
DROP POLICY IF EXISTS comms_service_bypass ON platform_comms;
DROP POLICY IF EXISTS platforms_service_bypass ON platforms;
DROP POLICY IF EXISTS platforms_tenant_isolation ON platforms;
DROP TABLE IF EXISTS platform_payloads;
DROP TABLE IF EXISTS platform_comms;
DROP INDEX IF EXISTS platforms_tenant;
DROP TABLE IF EXISTS platforms;
