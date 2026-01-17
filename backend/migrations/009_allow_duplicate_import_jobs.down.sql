CREATE UNIQUE INDEX IF NOT EXISTS idx_import_jobs_checksum_success
    ON import_jobs (checksum)
    WHERE status = 'succeeded';
