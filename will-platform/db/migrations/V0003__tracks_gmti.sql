-- Sprint 3 — S3-03 — extend tracks for GMTI specifics.
-- Reviewed by: Tech Lead, Security Engineer, Compliance Officer.
-- ADR reference: ADR-005 (STANAG 4774 classification stays in `classification`).
-- The radar-specific fields land as first-class columns so we can index and
-- filter; everything else still rides in `metadata` JSONB.

ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS track_kind TEXT NOT NULL DEFAULT 'point'
        CHECK (track_kind IN ('point', 'gmti', 'cot', 'mavlink')),
    ADD COLUMN IF NOT EXISTS velocity_radial_mps DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS snr_db                DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS gmti_job_id           BIGINT,
    ADD COLUMN IF NOT EXISTS gmti_mti_report_index INTEGER;

CREATE INDEX IF NOT EXISTS tracks_kind_observed_at
    ON tracks (track_kind, observed_at DESC);

COMMENT ON COLUMN tracks.track_kind IS
    'Coarse track family used by the frontend layer toggle and by tenant-scoped feature toggles.';
COMMENT ON COLUMN tracks.velocity_radial_mps IS
    'GMTI line-of-sight velocity in m/s; positive = receding from radar.';
