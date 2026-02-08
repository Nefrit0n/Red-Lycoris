-- Flexible per-scanner tracking table (replaces hardcoded semgrep_status / trivy_status columns).
CREATE TABLE IF NOT EXISTS analysis_job_scanners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
    scanner TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    artifact_key TEXT,
    import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    duration_ms INT,
    UNIQUE (job_id, scanner)
);

CREATE INDEX IF NOT EXISTS idx_analysis_job_scanners_job_id
    ON analysis_job_scanners (job_id);
CREATE INDEX IF NOT EXISTS idx_analysis_job_scanners_status
    ON analysis_job_scanners (status);
