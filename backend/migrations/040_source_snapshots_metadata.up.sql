ALTER TABLE product_source_snapshots
    ADD COLUMN IF NOT EXISTS original_filename TEXT,
    ADD COLUMN IF NOT EXISTS label TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE analysis_jobs
    ADD COLUMN IF NOT EXISTS source_kind TEXT;

UPDATE analysis_jobs
SET source_kind = CASE
    WHEN source_snapshot_id IS NULL THEN 'ephemeral'
    ELSE 'snapshot'
END
WHERE source_kind IS NULL;

ALTER TABLE analysis_jobs
    ALTER COLUMN source_kind SET NOT NULL;
