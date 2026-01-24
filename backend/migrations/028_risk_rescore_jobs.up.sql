CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS risk_rescore_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NULL,
    model_version TEXT NOT NULL,
    status TEXT NOT NULL,
    cursor_last_finding_id UUID NULL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NULL,
    stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_rescore_jobs_status
    ON risk_rescore_jobs (status);

CREATE INDEX IF NOT EXISTS idx_risk_rescore_jobs_tenant_model
    ON risk_rescore_jobs (tenant_id, model_version);
