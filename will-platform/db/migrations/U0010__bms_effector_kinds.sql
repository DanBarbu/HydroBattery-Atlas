ALTER TABLE effectors DROP CONSTRAINT IF EXISTS effectors_kind_check;
ALTER TABLE effectors ADD CONSTRAINT effectors_kind_check
    CHECK (kind IN ('sam_area','sam_point','nsm_coastal','jammer_rf','c_uas','other'));
