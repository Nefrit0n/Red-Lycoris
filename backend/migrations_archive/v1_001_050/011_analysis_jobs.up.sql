CREATE TABLE IF NOT EXISTS analysis_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    engagement_id UUID REFERENCES engagements(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    scanners TEXT[] NOT NULL,
    semgrep_status TEXT NOT NULL DEFAULT 'pending',
    trivy_status TEXT NOT NULL DEFAULT 'pending',
    findings_total INT NOT NULL DEFAULT 0,
    findings_new INT NOT NULL DEFAULT 0,
    duplicates_total INT NOT NULL DEFAULT 0,
    archive_key TEXT,
    archive_size BIGINT NOT NULL DEFAULT 0,
    artifact_semgrep_key TEXT,
    artifact_trivy_key TEXT,
    semgrep_import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL,
    trivy_import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL,
    idempotency_key TEXT,
    error_message TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created_at ON analysis_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_product_id ON analysis_jobs (product_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_analysis_jobs_idempotency_key
    ON analysis_jobs (idempotency_key)
    WHERE idempotency_key IS NOT NULL;
