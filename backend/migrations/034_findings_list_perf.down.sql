DROP INDEX IF EXISTS idx_findings_cursor_sort_key;

ALTER TABLE findings
    DROP COLUMN IF EXISTS cwe,
    DROP COLUMN IF EXISTS owasp;
