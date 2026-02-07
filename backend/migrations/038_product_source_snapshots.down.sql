DROP INDEX IF EXISTS idx_analysis_jobs_source_snapshot_id;

ALTER TABLE analysis_jobs
    DROP COLUMN IF EXISTS source_snapshot_id;

DROP INDEX IF EXISTS idx_product_source_snapshots_tenant_product_created;
DROP INDEX IF EXISTS idx_product_source_snapshots_product_created;

DROP TABLE IF EXISTS product_source_snapshots;
