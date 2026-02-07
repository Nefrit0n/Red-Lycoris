CREATE TABLE IF NOT EXISTS product_source_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    object_key TEXT NOT NULL,
    archive_size BIGINT NOT NULL,
    sha256 TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_product_source_snapshots_product_created
    ON product_source_snapshots (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_source_snapshots_tenant_product_created
    ON product_source_snapshots (tenant_id, product_id, created_at DESC);

ALTER TABLE analysis_jobs
    ADD COLUMN IF NOT EXISTS source_snapshot_id UUID REFERENCES product_source_snapshots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_source_snapshot_id
    ON analysis_jobs (source_snapshot_id);
