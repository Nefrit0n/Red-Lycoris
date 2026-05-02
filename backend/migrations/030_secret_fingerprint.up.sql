ALTER TABLE findings ADD COLUMN secret_fingerprint TEXT;

-- Partial index — only secrets findings carry this column.
CREATE INDEX idx_findings_secret_fingerprint
    ON findings (secret_fingerprint)
    WHERE secret_fingerprint IS NOT NULL;
