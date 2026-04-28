DROP INDEX IF EXISTS idx_findings_secret_fingerprint;
ALTER TABLE findings DROP COLUMN IF EXISTS secret_fingerprint;
