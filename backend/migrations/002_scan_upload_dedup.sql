ALTER TABLE scan_results
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE scan_results
    ALTER COLUMN engagement_id DROP NOT NULL;

ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS fingerprint TEXT;

ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS duplicate_id UUID REFERENCES findings(id) ON DELETE SET NULL;

UPDATE findings
SET fingerprint = encode(digest(title || '|' || scan_result_id::text, 'sha256'), 'hex')
WHERE fingerprint IS NULL;

ALTER TABLE findings
    ALTER COLUMN fingerprint SET NOT NULL;

UPDATE findings
SET status = 'new'
WHERE status IS NULL OR status = '';

ALTER TABLE findings
    ALTER COLUMN status SET DEFAULT 'new';

ALTER TABLE findings
    ALTER COLUMN status SET NOT NULL;

ALTER TABLE findings
    DROP CONSTRAINT IF EXISTS findings_scan_result_id_title_key;

CREATE INDEX IF NOT EXISTS idx_findings_fingerprint ON findings (fingerprint);

CREATE INDEX IF NOT EXISTS idx_findings_scan_result_id ON findings (scan_result_id);
