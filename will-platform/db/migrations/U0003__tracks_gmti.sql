DROP INDEX IF EXISTS tracks_kind_observed_at;
ALTER TABLE tracks
    DROP COLUMN IF EXISTS gmti_mti_report_index,
    DROP COLUMN IF EXISTS gmti_job_id,
    DROP COLUMN IF EXISTS snr_db,
    DROP COLUMN IF EXISTS velocity_radial_mps,
    DROP COLUMN IF EXISTS track_kind;
