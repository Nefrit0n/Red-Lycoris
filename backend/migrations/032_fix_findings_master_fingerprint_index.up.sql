-- Fix: idx_findings_master_fingerprint_product must apply only to master findings.
-- Otherwise importing a scan that contains repeats fails because duplicates share the same (tenant_id,fingerprint,product_id).

DROP INDEX IF EXISTS idx_findings_master_fingerprint_product;

CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_master_fingerprint_product
    ON findings (tenant_id, fingerprint, product_id)
    WHERE duplicate_id IS NULL AND deleted_at IS NULL;
