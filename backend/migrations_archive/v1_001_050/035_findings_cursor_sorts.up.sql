ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS severity_rank SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS status_rank SMALLINT NOT NULL DEFAULT 0;

UPDATE findings
SET severity_rank = CASE LOWER(severity)
        WHEN 'critical' THEN 4
        WHEN 'high' THEN 3
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 1
        ELSE 0
    END,
    status_rank = CASE LOWER(status)
        WHEN 'new' THEN 1
        WHEN 'under_review' THEN 2
        WHEN 'confirmed' THEN 3
        WHEN 'mitigated' THEN 4
        WHEN 'false_positive' THEN 5
        WHEN 'out_of_scope' THEN 6
        WHEN 'risk_accepted' THEN 7
        WHEN 'duplicate' THEN 8
        ELSE 0
    END;

CREATE INDEX IF NOT EXISTS idx_findings_cursor_last_seen_desc
    ON findings (tenant_id, product_id, COALESCE(last_seen_at, created_at) DESC, id DESC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_cursor_created_at_desc
    ON findings (tenant_id, product_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_cursor_severity_desc
    ON findings (tenant_id, product_id, severity_rank DESC, id DESC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_cursor_status_desc
    ON findings (tenant_id, product_id, status_rank DESC, id DESC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_cursor_title_desc
    ON findings (tenant_id, product_id, title DESC, id DESC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_cursor_sla_due_desc
    ON findings (tenant_id, product_id, COALESCE(sla_due_at, TIMESTAMPTZ '0001-01-01T00:00:00Z') DESC, id DESC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_cursor_sla_due_asc
    ON findings (tenant_id, product_id, COALESCE(sla_due_at, TIMESTAMPTZ '9999-12-31T23:59:59Z') ASC, id ASC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_finding_risk_tenant_score_desc
    ON finding_risk (tenant_id, risk_score DESC, finding_id);

CREATE INDEX IF NOT EXISTS idx_finding_risk_tenant_score_asc
    ON finding_risk (tenant_id, risk_score ASC, finding_id);
