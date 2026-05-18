-- Air-Defence effector expansion (extends ADR-008; analysis option B).
-- Adds the air_intercept (CAP fighter) and gun_shorad (Skynex/GDF-103)
-- effector kinds to the V0007 effectors CHECK constraint.

ALTER TABLE effectors DROP CONSTRAINT IF EXISTS effectors_kind_check;
ALTER TABLE effectors ADD CONSTRAINT effectors_kind_check
    CHECK (kind IN (
        'sam_area','sam_point','nsm_coastal','jammer_rf','c_uas',
        'air_intercept','gun_shorad','other'
    ));

COMMENT ON COLUMN effectors.kind IS
    'sam_area (Patriot, BMD-capable) · sam_point (C-RAM) · nsm_coastal (NSM) · '
    'jammer_rf · c_uas · air_intercept (CAP fighter + AAM) · gun_shorad (Skynex/GDF-103).';
