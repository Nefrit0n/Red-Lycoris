-- 012_vuln_intel.down.sql

BEGIN;

DROP INDEX IF EXISTS idx_findings_vulnerability_intel_id;
DROP INDEX IF EXISTS idx_vuln_intel_vulnerability_id;

ALTER TABLE findings
    DROP COLUMN IF EXISTS vulnerability_intel_id;

DROP TABLE IF EXISTS vulnerability_intel;

ALTER TABLE findings
    DROP COLUMN IF EXISTS raw_data;

ALTER TABLE findings
    DROP COLUMN IF EXISTS evidence;

COMMIT;
