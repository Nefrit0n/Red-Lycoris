ALTER TABLE product_source_snapshots
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

DROP INDEX IF EXISTS idx_product_source_snapshots_idempotency_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_source_snapshots_idempotency_key
    ON product_source_snapshots (tenant_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
