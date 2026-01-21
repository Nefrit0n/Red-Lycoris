-- 012_vuln_intel.up.sql

-- gen_random_uuid() требует pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- ============================================================
-- 1) Evidence / Raw data для findings
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
-- 2) Vulnerability intelligence (обогащение CVE / SCA)
-- ============================================================

CREATE TABLE IF NOT EXISTS vulnerability_intel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- идентификаторы
    vulnerability_id TEXT NOT NULL,           -- CVE-XXXX / GHSA-XXXX
    source           TEXT NOT NULL,           -- trivy / osv / nvd

    -- scoring
    severity         TEXT,
    cvss_v3_score    NUMERIC,
    cvss_v3_vector   TEXT,

    -- содержимое
    description      TEXT,
    references_json  JSONB,                   -- !!! НЕ "references"
    published_at     TIMESTAMPTZ,
    modified_at      TIMESTAMPTZ,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_vuln_intel UNIQUE (vulnerability_id, source)
);

COMMENT ON TABLE vulnerability_intel IS
    'Normalized vulnerability intelligence (CVE, GHSA)';

-- ============================================================
-- 3) Link findings -> vulnerability_intel (optional)
-- ============================================================

ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS vulnerability_intel_id UUID;

COMMENT ON COLUMN findings.vulnerability_intel_id IS
    'Reference to vulnerability_intel (optional, async populated)';

-- ============================================================
-- 4) Индексы
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_findings_vulnerability_intel_id
    ON findings (vulnerability_intel_id);

CREATE INDEX IF NOT EXISTS idx_vuln_intel_vulnerability_id
    ON vulnerability_intel (vulnerability_id);

COMMIT;
