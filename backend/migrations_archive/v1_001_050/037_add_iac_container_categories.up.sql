-- Add IAC and CONTAINER to findings category constraint
-- This fixes uploads from IaC scanners (tfsec, terrascan, checkov, kics) and container scanners (grype)

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find and drop the existing category constraint
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE t.relname = 'findings'
      AND n.nspname = current_schema()
      AND c.contype = 'c'
      AND a.attname = 'category'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE findings DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

-- Add new constraint with IAC and CONTAINER categories
ALTER TABLE findings
    ADD CONSTRAINT findings_category_check_v3
    CHECK (category IN ('SAST', 'SCA', 'SECRETS', 'CONFIG', 'DAST', 'LICENSE', 'UNKNOWN', 'IAC', 'CONTAINER'));
