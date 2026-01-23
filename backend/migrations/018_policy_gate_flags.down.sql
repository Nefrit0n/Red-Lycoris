ALTER TABLE scan_results
    DROP COLUMN IF EXISTS gate_failed;

ALTER TABLE import_jobs
    DROP COLUMN IF EXISTS gate_failed;
