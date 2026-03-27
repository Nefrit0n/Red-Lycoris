DROP INDEX IF EXISTS idx_product_source_snapshots_idempotency_key;

ALTER TABLE product_source_snapshots
    DROP COLUMN IF EXISTS idempotency_key;
