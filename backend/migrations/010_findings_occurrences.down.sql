DROP INDEX IF EXISTS idx_findings_master_fingerprint_product;
DROP INDEX IF EXISTS idx_findings_last_seen_at;

ALTER TABLE findings
    DROP COLUMN IF EXISTS repeat_count,
    DROP COLUMN IF EXISTS last_seen_at,
    DROP COLUMN IF EXISTS first_seen_at;

DROP INDEX IF EXISTS idx_import_jobs_product_created_at;

ALTER TABLE import_jobs
    DROP COLUMN IF EXISTS product_id;
