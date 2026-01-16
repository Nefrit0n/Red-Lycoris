ALTER TABLE products
    ADD COLUMN IF NOT EXISTS identifier TEXT,
    ADD COLUMN IF NOT EXISTS version TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_identifier_unique
    ON products (identifier)
    WHERE identifier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_name_version
    ON products (name, version);

ALTER TABLE scan_results
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS uploader_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scan_results_product_id ON scan_results (product_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_uploader_id ON scan_results (uploader_id);
