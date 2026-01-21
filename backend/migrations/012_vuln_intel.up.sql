-- 012_vuln_intel.up.sql

-- gen_random_uuid() requires pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- ============================================================
-- 1) Evidence / Raw data for findings
-- ============================================================

ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS evidence JSONB;

ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS raw_data JSONB;

COMMENT ON COLUMN findings.evidence IS
    'Structured scanner evidence (semgrep, trivy, etc) used for FindingDetail';

COMMENT ON COLUMN findings.raw_data IS
    'Raw parsed scanner payload for debugging and future enrichment';

-- ============================================================
-- 2) Finding to vulnerability identifiers junction table
-- ============================================================

CREATE TABLE IF NOT EXISTS finding_vuln_identifiers (
    finding_id  UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    identifier  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (finding_id, identifier)
);

CREATE INDEX IF NOT EXISTS idx_finding_vuln_identifiers_identifier
    ON finding_vuln_identifiers (identifier);

COMMENT ON TABLE finding_vuln_identifiers IS
    'Links findings to vulnerability identifiers (CVE-XXXX, GHSA-XXXX)';

-- ============================================================
-- 3) Vulnerability intelligence cache from external sources
-- ============================================================

CREATE TABLE IF NOT EXISTS vuln_intel (
    identifier      TEXT NOT NULL,
    source_version  TEXT NOT NULL DEFAULT 'v1',

    -- Raw payloads from providers
    nvd_payload             JSONB,
    epss_payload            JSONB,
    kev_payload             JSONB,
    references_payload      JSONB,

    -- Extracted scores for quick access
    cvss_score      NUMERIC,
    cvss_version    TEXT,
    epss_score      NUMERIC,
    epss_percentile NUMERIC,
    kev             BOOLEAN NOT NULL DEFAULT FALSE,

    -- Refresh tracking
    last_refreshed_at TIMESTAMPTZ,
    next_retry_at     TIMESTAMPTZ,
    last_error        TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (identifier, source_version)
);

CREATE INDEX IF NOT EXISTS idx_vuln_intel_identifier
    ON vuln_intel (identifier);

CREATE INDEX IF NOT EXISTS idx_vuln_intel_next_retry
    ON vuln_intel (next_retry_at)
    WHERE next_retry_at IS NOT NULL;

COMMENT ON TABLE vuln_intel IS
    'Cached vulnerability intelligence from NVD, EPSS, CISA KEV';

COMMIT;
