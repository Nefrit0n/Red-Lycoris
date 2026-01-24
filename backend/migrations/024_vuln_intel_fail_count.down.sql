BEGIN;

ALTER TABLE vuln_intel
    DROP COLUMN IF EXISTS fail_count;

COMMIT;
