-- Remove legacy LOWER(software_name) index across schemas.
DO $$
DECLARE idx RECORD;
BEGIN
    FOR idx IN
        SELECT schemaname, indexname
        FROM pg_indexes
        WHERE indexname = 'idx_bdu_vulnerabilities_software_name_lower'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I.%I', idx.schemaname, idx.indexname);
    END LOOP;
END$$;

-- Ensure safe md5-based index exists for software_name matching.
CREATE INDEX IF NOT EXISTS idx_bdu_vulnerabilities_software_name_md5
    ON public.bdu_vulnerabilities (md5(LOWER(software_name)));
