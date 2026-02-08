ALTER TABLE analysis_jobs
    ALTER COLUMN source_kind DROP NOT NULL;

ALTER TABLE analysis_jobs
    DROP COLUMN IF EXISTS source_kind;

ALTER TABLE product_source_snapshots
    DROP COLUMN IF EXISTS notes,
    DROP COLUMN IF EXISTS label,
    DROP COLUMN IF EXISTS original_filename;
