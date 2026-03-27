-- rollback for 048_integration_tokens_ingest

DROP TRIGGER IF EXISTS trg_integration_tokens_active_name_uniqueness ON integration_tokens;
DROP FUNCTION IF EXISTS enforce_integration_token_active_name_uniqueness();

DROP INDEX IF EXISTS idx_ingest_artifacts_org_project_sha256;
DROP INDEX IF EXISTS idx_ingest_artifacts_org_project_run;
DROP INDEX IF EXISTS ux_ingest_artifacts_run_sha256_path;
DROP TABLE IF EXISTS ingest_artifacts;

DROP INDEX IF EXISTS idx_ingest_runs_org_project_commit_sha;
DROP INDEX IF EXISTS idx_ingest_runs_org_project_pipeline_id;
DROP INDEX IF EXISTS idx_ingest_runs_org_project_created_at_desc;
DROP INDEX IF EXISTS ux_ingest_runs_org_project_idempotency;
DROP TABLE IF EXISTS ingest_runs;

DROP TABLE IF EXISTS org_security_policies;

DROP INDEX IF EXISTS idx_integration_token_events_type_at_desc;
DROP INDEX IF EXISTS idx_integration_token_events_org_at_desc;
DROP INDEX IF EXISTS idx_integration_token_events_org_token_at_desc;
DROP TABLE IF EXISTS integration_token_events;

DROP INDEX IF EXISTS idx_integration_tokens_org_project_last_used_at_desc;
DROP INDEX IF EXISTS idx_integration_tokens_org_project_expires_at;
DROP INDEX IF EXISTS idx_integration_tokens_org_project_created_at_desc;
DROP INDEX IF EXISTS ux_integration_tokens_org_project_name_unrevoked;
DROP TABLE IF EXISTS integration_tokens;
