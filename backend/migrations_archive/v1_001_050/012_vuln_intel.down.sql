-- 012_vuln_intel.down.sql

BEGIN;

DROP INDEX IF EXISTS idx_vuln_intel_next_retry;
DROP INDEX IF EXISTS idx_vuln_intel_identifier;
DROP TABLE IF EXISTS vuln_intel;

DROP INDEX IF EXISTS idx_finding_vuln_identifiers_identifier;
DROP TABLE IF EXISTS finding_vuln_identifiers;

ALTER TABLE findings
    DROP COLUMN IF EXISTS raw_data;

ALTER TABLE findings
    DROP COLUMN IF EXISTS evidence;

COMMIT;
