ALTER TABLE sbom_edges
    DROP CONSTRAINT IF EXISTS sbom_edges_from_component_id_fkey,
    DROP CONSTRAINT IF EXISTS sbom_edges_to_component_id_fkey;

ALTER TABLE sbom_edges
    ADD CONSTRAINT sbom_edges_from_component_id_fkey
        FOREIGN KEY (from_component_id) REFERENCES components(id) ON DELETE CASCADE,
    ADD CONSTRAINT sbom_edges_to_component_id_fkey
        FOREIGN KEY (to_component_id) REFERENCES components(id) ON DELETE CASCADE;

DROP TABLE IF EXISTS sbom_component_occurrences;

UPDATE sboms
SET index_status = 'pending'
WHERE index_status = 'queued';

UPDATE sboms
SET index_status = 'indexed'
WHERE index_status = 'done';

ALTER TABLE sboms
    ALTER COLUMN index_status SET DEFAULT 'pending';
