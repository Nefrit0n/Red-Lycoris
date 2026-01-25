-- Migration to enforce NOT NULL on tenant_id columns
-- This ensures proper tenant isolation at the database level

-- First, update any NULL tenant_id values to a default tenant
-- In production, you should handle this data migration carefully
-- This migration assumes single-tenant mode or that NULL means "default tenant"

-- Create a default tenant UUID if needed (for existing data migration)
DO $$
DECLARE
    default_tenant_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- Update findings with NULL tenant_id
    UPDATE findings SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;

    -- Update products with NULL tenant_id
    UPDATE products SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;

    -- Update scan_results with NULL tenant_id
    UPDATE scan_results SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;

    -- Update import_jobs with NULL tenant_id
    UPDATE import_jobs SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;

    -- Update analysis_jobs with NULL tenant_id
    UPDATE analysis_jobs SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
END $$;

-- Now add NOT NULL constraints
ALTER TABLE findings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE products ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE scan_results ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE import_jobs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE analysis_jobs ALTER COLUMN tenant_id SET NOT NULL;

-- Drop the obsolete FTS index (replaced by trigram indexes in migration 029)
DROP INDEX IF EXISTS idx_findings_description_fts;

-- Add comment for documentation
COMMENT ON COLUMN findings.tenant_id IS 'Tenant UUID - required for multi-tenant isolation';
COMMENT ON COLUMN products.tenant_id IS 'Tenant UUID - required for multi-tenant isolation';
