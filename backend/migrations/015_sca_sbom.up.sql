ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS category TEXT;

UPDATE findings f
SET category = CASE
    WHEN sr.scanner = 'trivy' THEN
        CASE
            WHEN COALESCE(f.evidence->>'findingType', '') = 'secret' THEN 'SECRETS'
            WHEN COALESCE(f.evidence->>'findingType', '') = 'misconfiguration' THEN 'CONFIG'
            WHEN COALESCE(f.evidence->>'findingType', '') = 'license' THEN 'CONFIG'
            WHEN COALESCE(f.evidence->>'findingType', '') = 'vulnerability' THEN 'SCA'
            ELSE 'SCA'
        END
    WHEN sr.scanner IN ('semgrep', 'sarif') THEN 'SAST'
    WHEN sr.scanner = 'zap' THEN 'CONFIG'
    ELSE 'SAST'
END
FROM scan_results sr
WHERE f.scan_result_id = sr.id
  AND f.category IS NULL;

UPDATE findings
SET category = 'SAST'
WHERE category IS NULL;

ALTER TABLE findings
    ALTER COLUMN category SET DEFAULT 'SAST';

ALTER TABLE findings
    ALTER COLUMN category SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'findings_category_check'
    ) THEN
        ALTER TABLE findings
            ADD CONSTRAINT findings_category_check
            CHECK (category IN ('SAST', 'SCA', 'SECRETS', 'CONFIG'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS sca_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purl TEXT,
    ecosystem TEXT,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sca_components_unique_purl
    ON sca_components (purl)
    WHERE purl IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sca_components_unique_name_ecosystem
    ON sca_components (ecosystem, name)
    WHERE purl IS NULL;

CREATE INDEX IF NOT EXISTS idx_sca_components_name
    ON sca_components (name);

CREATE TABLE IF NOT EXISTS sca_findings (
    finding_id UUID PRIMARY KEY REFERENCES findings(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES sca_components(id) ON DELETE RESTRICT,
    installed_version TEXT NOT NULL,
    fixed_version TEXT,
    vulnerability_id TEXT NOT NULL,
    primary_url TEXT,
    raw_severity TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sca_findings_component_id
    ON sca_findings (component_id);

CREATE INDEX IF NOT EXISTS idx_sca_findings_vulnerability_id
    ON sca_findings (vulnerability_id);

CREATE TABLE IF NOT EXISTS sboms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    format TEXT NOT NULL,
    object_key TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sboms_format_check'
    ) THEN
        ALTER TABLE sboms
            ADD CONSTRAINT sboms_format_check
            CHECK (format IN ('cyclonedx', 'spdx', 'spdx-json'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sboms_product_created_at
    ON sboms (product_id, created_at DESC);
