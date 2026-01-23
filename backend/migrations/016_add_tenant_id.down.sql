DROP INDEX IF EXISTS idx_analysis_jobs_tenant_id;
DROP INDEX IF EXISTS idx_findings_tenant_id;
DROP INDEX IF EXISTS idx_import_jobs_tenant_id;
DROP INDEX IF EXISTS idx_scan_results_tenant_id;
DROP INDEX IF EXISTS idx_products_tenant_id;

DROP INDEX IF EXISTS idx_products_identifier_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_identifier_unique
    ON products (identifier)
    WHERE identifier IS NOT NULL;

DROP INDEX IF EXISTS idx_findings_master_fingerprint_product;
CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_master_fingerprint_product
    ON findings (fingerprint, product_id);

ALTER TABLE analysis_jobs
    DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE findings
    DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE import_jobs
    DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE scan_results
    DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE products
    DROP COLUMN IF EXISTS tenant_id;
