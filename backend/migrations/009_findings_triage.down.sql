DROP INDEX IF EXISTS idx_findings_assigned_open;

ALTER TABLE findings
    DROP COLUMN IF EXISTS assigned_to,
    DROP COLUMN IF EXISTS closed_by,
    DROP COLUMN IF EXISTS closed_at,
    DROP COLUMN IF EXISTS closure_note,
    DROP COLUMN IF EXISTS closure_reason_id;
