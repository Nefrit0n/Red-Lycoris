ALTER TABLE sboms
    ADD COLUMN IF NOT EXISTS transitive_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS transitive_updated_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS transitive_error TEXT NULL;

CREATE TABLE IF NOT EXISTS sbom_component_vulns (
    sbom_id UUID NOT NULL REFERENCES sboms(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES sca_components(id) ON DELETE CASCADE,
    identifier TEXT NOT NULL,
    severity TEXT NOT NULL,
    cvss_score DOUBLE PRECISION NULL,
    epss_score DOUBLE PRECISION NULL,
    fixed_version TEXT NULL,
    source TEXT NOT NULL DEFAULT 'osv',
    UNIQUE (sbom_id, component_id, identifier)
);

CREATE INDEX IF NOT EXISTS idx_sbom_component_vulns_component
    ON sbom_component_vulns (sbom_id, component_id);

CREATE INDEX IF NOT EXISTS idx_sbom_component_vulns_identifier
    ON sbom_component_vulns (sbom_id, identifier);

CREATE TABLE IF NOT EXISTS sbom_transitive_exposure (
    sbom_id UUID NOT NULL REFERENCES sboms(id) ON DELETE CASCADE,
    root_component_id UUID NOT NULL REFERENCES sca_components(id) ON DELETE CASCADE,
    max_depth INT NOT NULL,
    critical_cnt INT NOT NULL DEFAULT 0,
    high_cnt INT NOT NULL DEFAULT 0,
    medium_cnt INT NOT NULL DEFAULT 0,
    low_cnt INT NOT NULL DEFAULT 0,
    max_cvss DOUBLE PRECISION NULL,
    max_epss DOUBLE PRECISION NULL,
    min_distance_to_any_vuln INT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (sbom_id, root_component_id, max_depth)
);

CREATE INDEX IF NOT EXISTS idx_sbom_transitive_exposure_sbom_depth
    ON sbom_transitive_exposure (sbom_id, max_depth);
