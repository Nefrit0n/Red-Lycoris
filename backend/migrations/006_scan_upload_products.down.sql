DROP INDEX IF EXISTS idx_scan_results_uploader_id;
DROP INDEX IF EXISTS idx_scan_results_product_id;

ALTER TABLE scan_results
    DROP COLUMN IF EXISTS uploader_id,
    DROP COLUMN IF EXISTS product_id;

DROP INDEX IF EXISTS idx_products_name_version;
DROP INDEX IF EXISTS idx_products_identifier_unique;

ALTER TABLE products
    DROP COLUMN IF EXISTS version,
    DROP COLUMN IF EXISTS identifier;
