BEGIN;

ALTER TABLE vuln_intel
    DROP COLUMN IF EXISTS bdu_payload;

COMMIT;
