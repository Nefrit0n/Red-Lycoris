ALTER TABLE import_jobs
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_import_jobs_product_created_at
    ON import_jobs (product_id, created_at DESC);

UPDATE import_jobs ij
SET product_id = sr.product_id
FROM scan_results sr
WHERE sr.import_job_id = ij.id
  AND ij.product_id IS NULL;

ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS repeat_count INT NOT NULL DEFAULT 0;

UPDATE findings
SET first_seen_at = COALESCE(first_seen_at, created_at),
    last_seen_at = COALESCE(last_seen_at, updated_at)
WHERE first_seen_at IS NULL OR last_seen_at IS NULL;

UPDATE findings f
SET repeat_count = COALESCE(d.duplicate_count, 0)
FROM (
    SELECT duplicate_id, COUNT(*) AS duplicate_count
    FROM findings
    WHERE duplicate_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY duplicate_id
) d
WHERE f.id = d.duplicate_id;

UPDATE findings f
SET last_seen_at = GREATEST(f.last_seen_at, d.last_seen_at)
FROM (
    SELECT duplicate_id, MAX(created_at) AS last_seen_at
    FROM findings
    WHERE duplicate_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY duplicate_id
) d
WHERE f.id = d.duplicate_id;

CREATE INDEX IF NOT EXISTS idx_findings_last_seen_at ON findings (last_seen_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_master_fingerprint_product
    ON findings (fingerprint, product_id)
    WHERE duplicate_id IS NULL;
