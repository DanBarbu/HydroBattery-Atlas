-- War-games training module. ADR-013. EXERCISE-isolated: nothing here
-- feeds the live BMS/BFT/fires/ownship pipeline. Tenant-scoped; RLS in the
-- ADR-006 shape.

CREATE TABLE IF NOT EXISTS scenarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slug            TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    difficulty      INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 4),
    domains         JSONB NOT NULL DEFAULT '[]'::jsonb,        -- ["air-defence","maritime",...]
    objectives      JSONB NOT NULL DEFAULT '[]'::jsonb,        -- [{id,title,weight,kind,target}]
    prerequisites   JSONB NOT NULL DEFAULT '[]'::jsonb,        -- [scenario slug]
    badge           TEXT NOT NULL DEFAULT '',
    estimated_min   INTEGER NOT NULL DEFAULT 15,
    classification  TEXT NOT NULL DEFAULT 'NESECRET',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS scenarios_tenant_diff ON scenarios (tenant_id, difficulty);

CREATE TABLE IF NOT EXISTS training_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    scenario_slug   TEXT NOT NULL,
    trainee         TEXT NOT NULL,
    -- Every run is exercise-flagged. There is no path from this row into a
    -- live entity table; this column exists so any export is unambiguous.
    exercise_id     TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN (
        'PLANNED','RUNNING','PAUSED','COMPLETE','ABORTED'
    )),
    score           DOUBLE PRECISION NOT NULL DEFAULT 0,
    grade           TEXT NOT NULL DEFAULT '',
    assessment      JSONB NOT NULL DEFAULT '[]'::jsonb,        -- [{objective_id,score,passed,notes}]
    badge_awarded   TEXT NOT NULL DEFAULT '',
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS runs_tenant_scenario ON training_runs (tenant_id, scenario_slug, score DESC);
CREATE INDEX IF NOT EXISTS runs_tenant_trainee  ON training_runs (tenant_id, trainee);

ALTER TABLE scenarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY scenarios_tenant_isolation ON scenarios
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY scenarios_service_bypass ON scenarios
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');

CREATE POLICY runs_tenant_isolation ON training_runs
    USING (current_setting('app.current_role', true) = 'cross_tenant_auditor'
        OR tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY runs_service_bypass ON training_runs
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (current_setting('app.service_bypass', true) = 'on');

COMMENT ON TABLE training_runs IS
    'War-games training runs. ADR-013. EXERCISE-isolated — no live-injection path exists.';
