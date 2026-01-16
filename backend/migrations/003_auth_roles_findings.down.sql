DROP INDEX IF EXISTS idx_findings_deleted_at;
DROP INDEX IF EXISTS idx_findings_product_id;

ALTER TABLE findings
    DROP COLUMN IF EXISTS deleted_at,
    DROP COLUMN IF EXISTS updated_at,
    DROP COLUMN IF EXISTS product_id,
    DROP COLUMN IF EXISTS status;

ALTER TABLE findings
    ALTER COLUMN scan_result_id SET NOT NULL;

ALTER TABLE findings
    DROP CONSTRAINT IF EXISTS findings_status_check;

DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS roles;
