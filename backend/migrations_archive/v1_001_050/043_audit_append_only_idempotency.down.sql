DROP INDEX IF EXISTS idx_idempotency_keys_tenant_created_at;
DROP TABLE IF EXISTS idempotency_keys;

DROP INDEX IF EXISTS idx_audit_log_tenant_target_created_at;
DROP INDEX IF EXISTS idx_audit_log_tenant_actor_created_at;
DROP INDEX IF EXISTS idx_audit_log_tenant_action_created_at;
DROP INDEX IF EXISTS idx_audit_log_tenant_created_at;

ALTER TABLE audit_log
    DROP COLUMN IF EXISTS metadata_json,
    DROP COLUMN IF EXISTS diff_json,
    DROP COLUMN IF EXISTS user_agent,
    DROP COLUMN IF EXISTS ip,
    DROP COLUMN IF EXISTS idempotency_key,
    DROP COLUMN IF EXISTS request_id,
    DROP COLUMN IF EXISTS actor_email_snapshot,
    DROP COLUMN IF EXISTS created_at,
    DROP COLUMN IF EXISTS tenant_id;
