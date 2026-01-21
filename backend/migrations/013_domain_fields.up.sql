ALTER TABLE products
    ADD COLUMN IF NOT EXISTS asset_criticality TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_asset_criticality_check'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT products_asset_criticality_check
            CHECK (asset_criticality IS NULL OR asset_criticality IN ('low', 'medium', 'high', 'critical'));
    END IF;
END $$;

ALTER TABLE scan_results
    ADD COLUMN IF NOT EXISTS source_type TEXT,
    ADD COLUMN IF NOT EXISTS source_version TEXT;

ALTER TABLE import_jobs
    ADD COLUMN IF NOT EXISTS source_type TEXT,
    ADD COLUMN IF NOT EXISTS source_version TEXT;

ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS source_type TEXT,
    ADD COLUMN IF NOT EXISTS source_version TEXT,
    ADD COLUMN IF NOT EXISTS endpoint_method TEXT,
    ADD COLUMN IF NOT EXISTS endpoint_path TEXT;
