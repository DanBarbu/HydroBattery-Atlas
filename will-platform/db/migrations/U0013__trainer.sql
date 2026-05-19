DROP POLICY IF EXISTS runs_service_bypass ON training_runs;
DROP POLICY IF EXISTS runs_tenant_isolation ON training_runs;
DROP POLICY IF EXISTS scenarios_service_bypass ON scenarios;
DROP POLICY IF EXISTS scenarios_tenant_isolation ON scenarios;
DROP INDEX IF EXISTS runs_tenant_trainee;
DROP INDEX IF EXISTS runs_tenant_scenario;
DROP TABLE IF EXISTS training_runs;
DROP INDEX IF EXISTS scenarios_tenant_diff;
DROP TABLE IF EXISTS scenarios;
