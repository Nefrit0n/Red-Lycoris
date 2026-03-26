-- Enable pg_trgm extension for trigram-based ILIKE optimization.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for the ILIKE search across findings and products.
-- These cover the WHERE clause: f.title ILIKE $9 OR f.description ILIKE $9
-- OR f.fingerprint ILIKE $9 OR p.identifier ILIKE $9 OR p.name ILIKE $9
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_findings_title_trgm
    ON findings USING gin (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_findings_fingerprint_trgm
    ON findings USING gin (fingerprint gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_trgm
    ON products USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_identifier_trgm
    ON products USING gin (identifier gin_trgm_ops);

-- Note: f.description is not indexed because it can be very large (up to 2000 chars)
-- and trigram GIN indexes on large text fields have high storage cost.
-- If description search is a hot path, consider a tsvector full-text index instead.
