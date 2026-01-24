ALTER TABLE sboms
    ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS index_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS index_error TEXT NULL,
    ADD COLUMN IF NOT EXISTS component_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS edge_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purl TEXT UNIQUE,
    name TEXT NOT NULL,
    version TEXT NULL,
    ecosystem TEXT NULL,
    supplier TEXT NULL,
    licenses JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_components_purl
    ON components (purl);

CREATE INDEX IF NOT EXISTS idx_components_ecosystem_name_version
    ON components (ecosystem, name, version);

CREATE TABLE IF NOT EXISTS sbom_components (
    sbom_id UUID NOT NULL REFERENCES sboms(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    bom_ref TEXT NULL,
    direct BOOLEAN NOT NULL DEFAULT false,
    properties JSONB NULL,
    PRIMARY KEY (sbom_id, component_id)
);

CREATE INDEX IF NOT EXISTS idx_sbom_components_sbom_direct
    ON sbom_components (sbom_id, direct);

CREATE INDEX IF NOT EXISTS idx_sbom_components_component
    ON sbom_components (component_id);

CREATE TABLE IF NOT EXISTS sbom_edges (
    sbom_id UUID NOT NULL REFERENCES sboms(id) ON DELETE CASCADE,
    from_component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    to_component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    PRIMARY KEY (sbom_id, from_component_id, to_component_id)
);

CREATE INDEX IF NOT EXISTS idx_sbom_edges_from
    ON sbom_edges (sbom_id, from_component_id);

CREATE INDEX IF NOT EXISTS idx_sbom_edges_to
    ON sbom_edges (sbom_id, to_component_id);
