-- Flyway "undo" migration for V0001. Requires Flyway Teams to execute,
-- but kept here so the rollback is reviewable in code. Sprint 0 DoD §7
-- requires reversibility "where reasonable".

DROP INDEX IF EXISTS tracks_source_observed_at;
DROP INDEX IF EXISTS tracks_tenant_observed_at;
DROP INDEX IF EXISTS tracks_geom_gist;
DROP TABLE IF EXISTS tracks;
