DROP POLICY IF EXISTS fms_service_bypass ON fire_mission_status;
DROP POLICY IF EXISTS fms_tenant_isolation ON fire_mission_status;
DROP POLICY IF EXISTS fscm_service_bypass ON fscm;
DROP POLICY IF EXISTS fscm_tenant_isolation ON fscm;
DROP INDEX IF EXISTS fms_tenant_status;
DROP TABLE IF EXISTS fire_mission_status;
DROP INDEX IF EXISTS fscm_tenant_type;
DROP TABLE IF EXISTS fscm;
