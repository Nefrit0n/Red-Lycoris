DROP TABLE IF EXISTS sbom_transitive_exposure;
DROP TABLE IF EXISTS sbom_component_vulns;

ALTER TABLE sboms
    DROP COLUMN IF EXISTS transitive_status,
    DROP COLUMN IF EXISTS transitive_updated_at,
    DROP COLUMN IF EXISTS transitive_error;
