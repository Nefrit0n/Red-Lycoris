-- Revert to previous category constraint (without IAC and CONTAINER)
-- Note: This will fail if there are existing findings with IAC or CONTAINER categories

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
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

ALTER TABLE findings
    ADD CONSTRAINT findings_category_check_v2
    CHECK (category IN ('SAST', 'SCA', 'SECRETS', 'CONFIG', 'DAST', 'LICENSE', 'UNKNOWN'));
