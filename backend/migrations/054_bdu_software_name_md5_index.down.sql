DROP INDEX IF EXISTS public.idx_bdu_vulnerabilities_software_name_md5;

CREATE INDEX IF NOT EXISTS idx_bdu_vulnerabilities_software_name_lower
    ON public.bdu_vulnerabilities (LOWER(software_name));
