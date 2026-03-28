-- Replace oversized LOWER(software_name) btree index with fixed-width md5 expression index.
-- Some BDU rows contain very long software_name values that exceed btree row size limits.
DROP INDEX IF EXISTS public.idx_bdu_vulnerabilities_software_name_lower;

CREATE INDEX IF NOT EXISTS idx_bdu_vulnerabilities_software_name_md5
    ON public.bdu_vulnerabilities (md5(LOWER(software_name)));
