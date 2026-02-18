ALTER TABLE analysis_job_scanners
    DROP COLUMN IF EXISTS result_count,
    DROP COLUMN IF EXISTS max_severity,
    DROP COLUMN IF EXISTS severity_counts;
