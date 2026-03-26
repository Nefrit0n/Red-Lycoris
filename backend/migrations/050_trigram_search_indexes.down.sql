DROP INDEX IF EXISTS idx_findings_title_trgm;
DROP INDEX IF EXISTS idx_findings_fingerprint_trgm;
DROP INDEX IF EXISTS idx_products_name_trgm;
DROP INDEX IF EXISTS idx_products_identifier_trgm;

-- Note: we intentionally do NOT drop the pg_trgm extension
-- because other migrations or manual queries may depend on it.
