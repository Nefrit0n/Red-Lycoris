ALTER TABLE products
    ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE scan_results
    ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE import_jobs
    ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE analysis_jobs
    ADD COLUMN IF NOT EXISTS tenant_id UUID;

DROP INDEX IF EXISTS idx_findings_master_fingerprint_product;
CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_master_fingerprint_product
    ON findings (tenant_id, fingerprint, product_id);

DROP INDEX IF EXISTS idx_products_identifier_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_identifier_unique
    ON products (tenant_id, identifier)
    WHERE identifier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products (tenant_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_tenant_id ON scan_results (tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_tenant_id ON import_jobs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_findings_tenant_id ON findings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_tenant_id ON analysis_jobs (tenant_id);
