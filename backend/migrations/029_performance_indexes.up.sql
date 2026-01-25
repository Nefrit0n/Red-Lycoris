-- Performance optimization indexes for findings queries

-- Index for tenant isolation queries (most common filter pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_findings_tenant_severity_status
    ON findings (tenant_id, severity, status)
    WHERE deleted_at IS NULL;

-- Index for scanner filter on scan_results (frequently used in finding queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_results_scanner
    ON scan_results (scanner);

-- Index for date range queries on computed last activity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_findings_last_activity
    ON findings (COALESCE(last_seen_at, created_at) DESC)
    WHERE deleted_at IS NULL;

-- Partial index for soft delete optimization (replaces full index scan)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_findings_active
    ON findings (id)
    WHERE deleted_at IS NULL;

-- Index for policy_results to optimize the DISTINCT ON subquery
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_policy_results_subject_evaluated
    ON policy_results (subject_type, subject_id, evaluated_at DESC);

-- Index for finding_risk joins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_finding_risk_finding_id
    ON finding_risk (finding_id);

-- Trigram index for ILIKE text search (requires pg_trgm extension)
-- This significantly speeds up ILIKE '%pattern%' queries
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_findings_title_trgm
    ON findings USING gin (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_findings_fingerprint_trgm
    ON findings USING gin (fingerprint gin_trgm_ops);

-- Index for products name search (used in finding queries with product name filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_trgm
    ON products USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_identifier_trgm
    ON products USING gin (identifier gin_trgm_ops)
    WHERE identifier IS NOT NULL;
