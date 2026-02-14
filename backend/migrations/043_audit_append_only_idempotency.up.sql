-- Audit v2 fields + tenant boundary + idempotency support

ALTER TABLE audit_log
    ADD COLUMN IF NOT EXISTS tenant_id UUID,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS actor_email_snapshot TEXT,
    ADD COLUMN IF NOT EXISTS request_id TEXT,
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS ip TEXT,
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS diff_json JSONB,
    ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE audit_log a
SET tenant_id = u.tenant_id
FROM users u
WHERE a.actor_id = u.id AND a.tenant_id IS NULL;

UPDATE audit_log
SET tenant_id = '00000000-0000-0000-0000-000000000000'
WHERE tenant_id IS NULL;

ALTER TABLE audit_log
    ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created_at
    ON audit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_action_created_at
    ON audit_log (tenant_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_actor_created_at
    ON audit_log (tenant_id, actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_target_created_at
    ON audit_log (tenant_id, target_type, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    tenant_id UUID NOT NULL,
    scope TEXT NOT NULL,
    key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_code INT NOT NULL,
    response_body_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, scope, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_tenant_created_at
    ON idempotency_keys (tenant_id, created_at DESC);
