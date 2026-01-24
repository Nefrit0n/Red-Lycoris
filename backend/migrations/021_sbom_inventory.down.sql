DROP TABLE IF EXISTS sbom_edges;
DROP TABLE IF EXISTS sbom_components;
DROP TABLE IF EXISTS components;

ALTER TABLE sboms
    DROP COLUMN IF EXISTS indexed_at,
    DROP COLUMN IF EXISTS index_status,
    DROP COLUMN IF EXISTS index_error,
    DROP COLUMN IF EXISTS component_count,
    DROP COLUMN IF EXISTS edge_count;
