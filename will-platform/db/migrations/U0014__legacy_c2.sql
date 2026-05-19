DROP POLICY IF EXISTS southbound_service_bypass ON southbound_messages;
DROP POLICY IF EXISTS southbound_tenant_isolation ON southbound_messages;
DROP POLICY IF EXISTS legacy_tracks_service_bypass ON legacy_tracks;
DROP POLICY IF EXISTS legacy_tracks_tenant_isolation ON legacy_tracks;
DROP INDEX IF EXISTS southbound_tenant;
DROP TABLE IF EXISTS southbound_messages;
DROP INDEX IF EXISTS legacy_tracks_tenant;
DROP TABLE IF EXISTS legacy_tracks;
