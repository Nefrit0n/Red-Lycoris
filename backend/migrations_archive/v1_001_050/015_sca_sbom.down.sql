DROP TABLE IF EXISTS sboms;

DROP TABLE IF EXISTS sca_findings;

DROP TABLE IF EXISTS sca_components;

ALTER TABLE findings
    DROP CONSTRAINT IF EXISTS findings_category_check;

ALTER TABLE findings
    DROP COLUMN IF EXISTS category;
