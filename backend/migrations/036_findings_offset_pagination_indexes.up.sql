-- Indexes to support offset pagination with canonical-only filters.
CREATE INDEX IF NOT EXISTS idx_findings_list_last_seen_desc
    ON findings (tenant_id, COALESCE(last_seen_at, created_at) DESC, id DESC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_list_severity_desc
    ON findings (tenant_id, severity_rank DESC, id DESC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_list_status_desc
    ON findings (tenant_id, status_rank DESC, id DESC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_list_created_desc
    ON findings (tenant_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_list_updated_desc
    ON findings (tenant_id, updated_at DESC, id DESC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_list_title_asc
    ON findings (tenant_id, title ASC, id ASC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_list_sla_due_desc
    ON findings (tenant_id, COALESCE(sla_due_at, TIMESTAMPTZ '0001-01-01T00:00:00Z') DESC, id DESC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_list_sla_due_asc
    ON findings (tenant_id, COALESCE(sla_due_at, TIMESTAMPTZ '9999-12-31T23:59:59Z') ASC, id ASC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;
