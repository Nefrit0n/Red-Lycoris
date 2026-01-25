-- Rollback NOT NULL constraints (allow NULL again)
ALTER TABLE findings ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE products ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE scan_results ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE import_jobs ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE analysis_jobs ALTER COLUMN tenant_id DROP NOT NULL;

-- Recreate the FTS index that was dropped
CREATE INDEX IF NOT EXISTS idx_findings_description_fts
    ON findings USING GIN (to_tsvector('simple', COALESCE(description, '')));

-- Remove comments
COMMENT ON COLUMN findings.tenant_id IS NULL;
COMMENT ON COLUMN products.tenant_id IS NULL;
