CREATE TABLE IF NOT EXISTS vuln_intel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    source_version TEXT NOT NULL DEFAULT 'v1',
    nvd_payload JSONB,
    epss_payload JSONB,
    kev_payload JSONB,
    references JSONB,
    cvss_score DOUBLE PRECISION,
    cvss_version TEXT,
    epss_score DOUBLE PRECISION,
    epss_percentile DOUBLE PRECISION,
    kev BOOLEAN NOT NULL DEFAULT FALSE,
    last_refreshed_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (identifier, source_version)
);

CREATE INDEX IF NOT EXISTS idx_vuln_intel_identifier ON vuln_intel (identifier);
CREATE INDEX IF NOT EXISTS idx_vuln_intel_refresh ON vuln_intel (last_refreshed_at);

CREATE TABLE IF NOT EXISTS finding_vuln_identifiers (
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    identifier TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (finding_id, identifier)
);

CREATE INDEX IF NOT EXISTS idx_finding_vuln_identifiers_identifier
    ON finding_vuln_identifiers (identifier);
CREATE INDEX IF NOT EXISTS idx_finding_vuln_identifiers_created_at
    ON finding_vuln_identifiers (created_at DESC);
