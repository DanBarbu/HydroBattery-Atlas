DROP POLICY IF EXISTS sensors_service_bypass ON sensors;
DROP POLICY IF EXISTS tracks_service_bypass ON tracks;
DROP POLICY IF EXISTS sensors_tenant_isolation ON sensors;
DROP POLICY IF EXISTS tracks_tenant_isolation ON tracks;
ALTER TABLE sensors DISABLE ROW LEVEL SECURITY;
ALTER TABLE tracks  DISABLE ROW LEVEL SECURITY;
