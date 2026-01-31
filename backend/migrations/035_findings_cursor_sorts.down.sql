DROP INDEX IF EXISTS idx_findings_cursor_last_seen_desc;
DROP INDEX IF EXISTS idx_findings_cursor_created_at_desc;
DROP INDEX IF EXISTS idx_findings_cursor_severity_desc;
DROP INDEX IF EXISTS idx_findings_cursor_status_desc;
DROP INDEX IF EXISTS idx_findings_cursor_title_desc;
DROP INDEX IF EXISTS idx_findings_cursor_sla_due_desc;
DROP INDEX IF EXISTS idx_findings_cursor_sla_due_asc;
DROP INDEX IF EXISTS idx_finding_risk_tenant_score_desc;
DROP INDEX IF EXISTS idx_finding_risk_tenant_score_asc;

ALTER TABLE findings
    DROP COLUMN IF EXISTS severity_rank,
    DROP COLUMN IF EXISTS status_rank;
