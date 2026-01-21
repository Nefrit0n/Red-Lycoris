CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings (severity);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings (status);
CREATE INDEX IF NOT EXISTS idx_findings_source_type ON findings (source_type);

CREATE INDEX IF NOT EXISTS idx_findings_product_status_severity
    ON findings (product_id, status, severity)
    WHERE deleted_at IS NULL;
