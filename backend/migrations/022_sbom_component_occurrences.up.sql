ALTER TABLE sboms
    ALTER COLUMN index_status SET DEFAULT 'queued';

UPDATE sboms
SET index_status = 'queued'
WHERE index_status = 'pending';

UPDATE sboms
SET index_status = 'done'
WHERE index_status = 'indexed';

CREATE TABLE IF NOT EXISTS sbom_component_occurrences (
    sbom_id UUID NOT NULL REFERENCES sboms(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES sca_components(id) ON DELETE CASCADE,
    version TEXT NULL,
    direct BOOLEAN NOT NULL DEFAULT false,
    bom_ref TEXT NULL,
    supplier TEXT NULL,
    licenses JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (sbom_id, component_id, version)
);

CREATE INDEX IF NOT EXISTS idx_sbom_component_occurrences_sbom_direct
    ON sbom_component_occurrences (sbom_id, direct);

CREATE INDEX IF NOT EXISTS idx_sbom_component_occurrences_component
    ON sbom_component_occurrences (component_id);

ALTER TABLE sbom_edges
    DROP CONSTRAINT IF EXISTS sbom_edges_from_component_id_fkey,
    DROP CONSTRAINT IF EXISTS sbom_edges_to_component_id_fkey;

ALTER TABLE sbom_edges
    ADD CONSTRAINT sbom_edges_from_component_id_fkey
        FOREIGN KEY (from_component_id) REFERENCES sca_components(id) ON DELETE CASCADE,
    ADD CONSTRAINT sbom_edges_to_component_id_fkey
        FOREIGN KEY (to_component_id) REFERENCES sca_components(id) ON DELETE CASCADE;
