ALTER TABLE findings
    DROP CONSTRAINT IF EXISTS findings_category_check_v2;

ALTER TABLE findings
    ADD CONSTRAINT findings_category_check
    CHECK (category IN ('SAST', 'SCA', 'SECRETS', 'CONFIG'));

DROP INDEX IF EXISTS idx_sca_components_unique_name_ecosystem;

ALTER TABLE sca_components
    ALTER COLUMN ecosystem DROP NOT NULL;

ALTER TABLE sca_components
    ALTER COLUMN ecosystem DROP DEFAULT;

UPDATE sca_components
SET ecosystem = NULL
WHERE ecosystem = 'unknown';

CREATE UNIQUE INDEX idx_sca_components_unique_name_ecosystem
    ON sca_components (ecosystem, name)
    WHERE purl IS NULL;
