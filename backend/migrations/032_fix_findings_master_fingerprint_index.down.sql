-- Revert: restore non-partial unique index (previous behavior).

DROP INDEX IF EXISTS idx_findings_master_fingerprint_product;

CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_master_fingerprint_product
    ON findings (tenant_id, fingerprint, product_id);
