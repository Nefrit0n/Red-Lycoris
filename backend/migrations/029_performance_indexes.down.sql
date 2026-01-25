-- Rollback performance optimization indexes

DROP INDEX CONCURRENTLY IF EXISTS idx_findings_tenant_severity_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_scan_results_scanner;
DROP INDEX CONCURRENTLY IF EXISTS idx_findings_last_activity;
DROP INDEX CONCURRENTLY IF EXISTS idx_findings_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_policy_results_subject_evaluated;
DROP INDEX CONCURRENTLY IF EXISTS idx_finding_risk_finding_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_findings_title_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_findings_fingerprint_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_products_name_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_products_identifier_trgm;

-- Note: pg_trgm extension is not dropped as it may be used elsewhere
