-- GitLab ingest + integration tokens storage model (SQL-only, no ORM)
-- Multi-tenant boundary: org_id + optional project_id (NULL = org-wide)

CREATE TABLE IF NOT EXISTS integration_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    project_id UUID NULL,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    scopes TEXT[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    last_used_at TIMESTAMPTZ NULL,
    created_by_user_id UUID NULL,
    metadata JSONB NULL,
    CONSTRAINT integration_tokens_expires_after_created_chk CHECK (expires_at > created_at),
    CONSTRAINT integration_tokens_non_empty_scopes_chk CHECK (cardinality(scopes) >= 1),
    CONSTRAINT integration_tokens_name_non_empty_chk CHECK (length(btrim(name)) > 0)
);

-- Requested partial unique semantics with active-name uniqueness.
-- PostgreSQL does not allow volatile/stable expressions (e.g. now()) in partial index predicates,
-- so the time-window portion is enforced with a trigger below.
CREATE UNIQUE INDEX IF NOT EXISTS ux_integration_tokens_org_project_name_unrevoked
    ON integration_tokens (org_id, project_id, name)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_integration_tokens_org_project_created_at_desc
    ON integration_tokens (org_id, project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_tokens_org_project_expires_at
    ON integration_tokens (org_id, project_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_integration_tokens_org_project_last_used_at_desc
    ON integration_tokens (org_id, project_id, last_used_at DESC);

CREATE TABLE IF NOT EXISTS integration_token_events (
    id BIGSERIAL PRIMARY KEY,
    org_id UUID NOT NULL,
    token_id UUID NOT NULL REFERENCES integration_tokens(id),
    event_type TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_id UUID NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip INET NULL,
    user_agent TEXT NULL,
    details JSONB NULL,
    CONSTRAINT integration_token_events_type_chk
        CHECK (event_type IN ('created', 'revoked', 'rotated', 'used', 'expiry_changed', 'name_changed')),
    CONSTRAINT integration_token_events_actor_chk
        CHECK (actor_type IN ('user', 'token', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_integration_token_events_org_token_at_desc
    ON integration_token_events (org_id, token_id, at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_token_events_org_at_desc
    ON integration_token_events (org_id, at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_token_events_type_at_desc
    ON integration_token_events (event_type, at DESC);

CREATE TABLE IF NOT EXISTS org_security_policies (
    org_id UUID PRIMARY KEY,
    default_token_ttl_days INT NOT NULL DEFAULT 90,
    max_token_ttl_days INT NOT NULL DEFAULT 365,
    CONSTRAINT org_security_policies_default_ttl_chk CHECK (default_token_ttl_days BETWEEN 1 AND 3650),
    CONSTRAINT org_security_policies_max_ttl_chk CHECK (max_token_ttl_days BETWEEN 1 AND 3650),
    CONSTRAINT org_security_policies_default_lte_max_chk CHECK (default_token_ttl_days <= max_token_ttl_days)
);

CREATE TABLE IF NOT EXISTS ingest_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    project_id UUID NOT NULL,
    status TEXT NOT NULL,
    x_idempotency_key TEXT NOT NULL,
    metadata_jsonb JSONB NOT NULL,
    metadata_sha256 TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    committed_at TIMESTAMPTZ NULL,
    pipeline_id TEXT NULL,
    job_id TEXT NULL,
    commit_sha TEXT NULL,
    ref_name TEXT NULL,
    pipeline_url TEXT NULL,
    job_url TEXT NULL,
    CONSTRAINT ingest_runs_status_chk CHECK (status IN ('INIT', 'UPLOADING', 'COMMITTED', 'FAILED')),
    CONSTRAINT ingest_runs_idempotency_non_empty_chk CHECK (length(btrim(x_idempotency_key)) > 0),
    CONSTRAINT ingest_runs_metadata_sha256_chk CHECK (metadata_sha256 ~ '^[A-Fa-f0-9]{64}$'),
    CONSTRAINT ingest_runs_commit_sha_chk CHECK (commit_sha IS NULL OR commit_sha ~ '^[A-Fa-f0-9]{40}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ingest_runs_org_project_idempotency
    ON ingest_runs (org_id, project_id, x_idempotency_key);

CREATE INDEX IF NOT EXISTS idx_ingest_runs_org_project_created_at_desc
    ON ingest_runs (org_id, project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingest_runs_org_project_pipeline_id
    ON ingest_runs (org_id, project_id, pipeline_id);

CREATE INDEX IF NOT EXISTS idx_ingest_runs_org_project_commit_sha
    ON ingest_runs (org_id, project_id, commit_sha);

CREATE TABLE IF NOT EXISTS ingest_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES ingest_runs(run_id),
    org_id UUID NOT NULL,
    project_id UUID NOT NULL,
    path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    media_type TEXT NOT NULL,
    format_hint TEXT NOT NULL,
    object_key TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NULL,
    verified_at TIMESTAMPTZ NULL,
    etag TEXT NULL,
    CONSTRAINT ingest_artifacts_size_bytes_chk CHECK (size_bytes > 0),
    CONSTRAINT ingest_artifacts_sha256_chk CHECK (sha256 ~ '^[A-Fa-f0-9]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ingest_artifacts_run_sha256_path
    ON ingest_artifacts (run_id, sha256, path);

CREATE INDEX IF NOT EXISTS idx_ingest_artifacts_org_project_run
    ON ingest_artifacts (org_id, project_id, run_id);

CREATE INDEX IF NOT EXISTS idx_ingest_artifacts_org_project_sha256
    ON ingest_artifacts (org_id, project_id, sha256);

-- Enforce requested active-name uniqueness including expiry window.
CREATE OR REPLACE FUNCTION enforce_integration_token_active_name_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.revoked_at IS NULL AND NEW.expires_at > NOW() THEN
        IF EXISTS (
            SELECT 1
            FROM integration_tokens it
            WHERE it.org_id = NEW.org_id
              AND it.project_id IS NOT DISTINCT FROM NEW.project_id
              AND it.name = NEW.name
              AND it.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
              AND it.revoked_at IS NULL
              AND it.expires_at > NOW()
        ) THEN
            RAISE EXCEPTION
                USING ERRCODE = 'unique_violation',
                      MESSAGE = 'active token name already exists for tenant boundary';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_integration_tokens_active_name_uniqueness ON integration_tokens;
CREATE TRIGGER trg_integration_tokens_active_name_uniqueness
BEFORE INSERT OR UPDATE OF org_id, project_id, name, expires_at, revoked_at
ON integration_tokens
FOR EACH ROW
EXECUTE FUNCTION enforce_integration_token_active_name_uniqueness();

-- Integrate with existing global audit table (append-only) without duplicating it.
INSERT INTO audit_log (
    id,
    actor_id,
    action,
    target_type,
    target_id,
    payload_json,
    occurred_at,
    created_at,
    tenant_id
)
SELECT
    gen_random_uuid(),
    NULL,
    'schema.migration.applied',
    'integration_tokens',
    NULL,
    jsonb_build_object('migration', '048_integration_tokens_ingest'),
    NOW(),
    NOW(),
    '00000000-0000-0000-0000-000000000000'::uuid
WHERE EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_log'
);
