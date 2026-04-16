DROP INDEX IF EXISTS idx_kev_catalog_ransomware;
DROP INDEX IF EXISTS idx_kev_catalog_due_date;
ALTER TABLE kev_catalog DROP COLUMN IF EXISTS required_action;
ALTER TABLE kev_catalog DROP COLUMN IF EXISTS short_description;
