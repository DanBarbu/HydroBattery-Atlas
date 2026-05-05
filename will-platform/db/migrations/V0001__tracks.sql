-- Sprint 0 — S0-03 — initial track storage with classification metadata stub.
-- Reviewed by: Tech Lead, Security Engineer, Compliance Officer.
-- ADR reference: ADR-003 (PostgreSQL+PostGIS as system of record),
--                ADR-005 (STANAG 4774 as canonical classification).

CREATE TABLE IF NOT EXISTS tracks (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    source        TEXT NOT NULL,
    geometry      geometry(Point, 4326) NOT NULL,
    altitude_m    DOUBLE PRECISION,
    heading_deg   DOUBLE PRECISION,
    speed_mps     DOUBLE PRECISION,
    classification TEXT NOT NULL DEFAULT 'NESECRET'
        CHECK (classification IN (
            'NESECRET',
            'SECRET_DE_SERVICIU',
            'SECRET',
            'STRICT_SECRET',
            'STRICT_SECRET_DE_IMPORTANTA_DEOSEBITA',
            -- NATO equivalents accepted at the API edge:
            'NATO_UNCLASSIFIED',
            'NATO_RESTRICTED',
            'NATO_CONFIDENTIAL',
            'NATO_SECRET'
        )),
    observed_at   TIMESTAMPTZ NOT NULL,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS tracks_geom_gist
    ON tracks USING GIST (geometry);

CREATE INDEX IF NOT EXISTS tracks_tenant_observed_at
    ON tracks (tenant_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS tracks_source_observed_at
    ON tracks (source, observed_at DESC);

COMMENT ON COLUMN tracks.classification IS
    'STANAG 4774 confidentiality label or RO national equivalent. '
    'Crypto binding (STANAG 4778) is added in Sprint 9.';
