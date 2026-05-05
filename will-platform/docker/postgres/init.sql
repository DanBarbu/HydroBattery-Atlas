-- Sprint 0 — bootstrap PostGIS in the will database.
-- Flyway owns the schema from V0001 onward.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
