ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS cwe TEXT[],
    ADD COLUMN IF NOT EXISTS owasp TEXT[];

UPDATE findings
SET cwe = COALESCE(cwe, CASE
        WHEN jsonb_typeof(evidence->'cwe') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(evidence->'cwe'))
        WHEN jsonb_typeof(evidence->'cwe') = 'string' THEN ARRAY[evidence->>'cwe']
        ELSE NULL
    END),
    owasp = COALESCE(owasp, CASE
        WHEN jsonb_typeof(evidence->'owasp') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(evidence->'owasp'))
        WHEN jsonb_typeof(evidence->'owasp') = 'string' THEN ARRAY[evidence->>'owasp']
        ELSE NULL
    END)
WHERE evidence IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_findings_cursor_sort_key
    ON findings (tenant_id, product_id, COALESCE(last_seen_at, created_at) DESC, id DESC)
    WHERE deleted_at IS NULL AND duplicate_id IS NULL;
