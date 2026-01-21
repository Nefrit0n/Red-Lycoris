ALTER TABLE products
    DROP CONSTRAINT IF EXISTS products_asset_criticality_check;

ALTER TABLE products
    DROP COLUMN IF EXISTS asset_criticality;

ALTER TABLE scan_results
    DROP COLUMN IF EXISTS source_type,
    DROP COLUMN IF EXISTS source_version;

ALTER TABLE import_jobs
    DROP COLUMN IF EXISTS source_type,
    DROP COLUMN IF EXISTS source_version;

ALTER TABLE findings
    DROP COLUMN IF EXISTS source_type,
    DROP COLUMN IF EXISTS source_version,
    DROP COLUMN IF EXISTS endpoint_method,
    DROP COLUMN IF EXISTS endpoint_path;
