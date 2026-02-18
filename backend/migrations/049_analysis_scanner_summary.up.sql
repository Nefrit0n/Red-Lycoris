ALTER TABLE analysis_job_scanners
    ADD COLUMN IF NOT EXISTS result_count INT,
    ADD COLUMN IF NOT EXISTS max_severity TEXT,
    ADD COLUMN IF NOT EXISTS severity_counts JSONB;
