DROP INDEX IF EXISTS idx_findings_has_fix;
DROP INDEX IF EXISTS idx_findings_secret_kind;
DROP INDEX IF EXISTS idx_findings_iac_provider;
DROP INDEX IF EXISTS idx_findings_ecosystem;
DROP INDEX IF EXISTS idx_findings_kind;

ALTER TABLE findings
    DROP COLUMN IF EXISTS rule_name,
    DROP COLUMN IF EXISTS rule_id,
    DROP COLUMN IF EXISTS commit_sha,
    DROP COLUMN IF EXISTS secret_kind,
    DROP COLUMN IF EXISTS iac_provider,
    DROP COLUMN IF EXISTS iac_resource,
    DROP COLUMN IF EXISTS http_evidence,
    DROP COLUMN IF EXISTS http_param,
    DROP COLUMN IF EXISTS http_method,
    DROP COLUMN IF EXISTS url,
    DROP COLUMN IF EXISTS code_flow,
    DROP COLUMN IF EXISTS code_snippet,
    DROP COLUMN IF EXISTS purl,
    DROP COLUMN IF EXISTS package_ecosystem,
    DROP COLUMN IF EXISTS fixed_version,
    DROP COLUMN IF EXISTS finding_kind;
