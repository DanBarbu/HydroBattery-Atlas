-- Sprint 4 — Sprint 3 retrospective carry-over #2.
-- Row-Level Security preview against the shared-DB profile (ADR-006 mode 1).
--
-- The session sets `app.current_tenant_id` and `app.current_role` before
-- any query. RLS denies cross-tenant reads except for the
-- `cross_tenant_auditor` role. This is *defence in depth* — the
-- application layer also filters; RLS is the second wall.
--
-- For the `schema` and `compartment` modes the policies are unnecessary
-- (the tenant boundary is enforced by the connection); the policies are
-- written defensively so they work in all three modes.

ALTER TABLE tracks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensors ENABLE ROW LEVEL SECURITY;

CREATE POLICY tracks_tenant_isolation ON tracks
    USING (
        current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true)
    );

CREATE POLICY sensors_tenant_isolation ON sensors
    USING (
        current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true)
    );

-- Service-role bypass for the tenant-admin and plugin-loader binaries
-- which must be able to read across tenants. Sprint 11 ORNISS file
-- documents this exception.
ALTER TABLE tracks  FORCE ROW LEVEL SECURITY;
ALTER TABLE sensors FORCE ROW LEVEL SECURITY;

CREATE POLICY tracks_service_bypass ON tracks
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');

CREATE POLICY sensors_service_bypass ON sensors
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');

COMMENT ON POLICY tracks_tenant_isolation ON tracks IS
    'ADR-006 shared-mode RLS. Applies when app.current_role != cross_tenant_auditor.';
