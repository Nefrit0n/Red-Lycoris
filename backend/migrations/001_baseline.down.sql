-- Down migration for 001_baseline: drops all tables, functions, and extensions.
-- WARNING: This will destroy ALL data. Use only for development/testing.

-- Drop trigger first
DROP TRIGGER IF EXISTS trg_integration_tokens_active_name_uniqueness ON integration_tokens;

-- Drop custom functions
DROP FUNCTION IF EXISTS enforce_integration_token_active_name_uniqueness();

-- Drop all tables (CASCADE handles foreign key dependencies)
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS finding_comments CASCADE;
DROP TABLE IF EXISTS finding_events CASCADE;
DROP TABLE IF EXISTS finding_risk CASCADE;
DROP TABLE IF EXISTS finding_vuln_identifiers CASCADE;
DROP TABLE IF EXISTS sca_findings CASCADE;
DROP TABLE IF EXISTS sca_components CASCADE;
DROP TABLE IF EXISTS findings CASCADE;
DROP TABLE IF EXISTS sbom_transitive_exposure CASCADE;
DROP TABLE IF EXISTS sbom_edges CASCADE;
DROP TABLE IF EXISTS sbom_component_vulns CASCADE;
DROP TABLE IF EXISTS sbom_component_occurrences CASCADE;
DROP TABLE IF EXISTS sbom_components CASCADE;
DROP TABLE IF EXISTS sboms CASCADE;
DROP TABLE IF EXISTS analysis_job_scanners CASCADE;
DROP TABLE IF EXISTS analysis_jobs CASCADE;
DROP TABLE IF EXISTS import_jobs CASCADE;
DROP TABLE IF EXISTS scan_results CASCADE;
DROP TABLE IF EXISTS ingest_artifacts CASCADE;
DROP TABLE IF EXISTS ingest_runs CASCADE;
DROP TABLE IF EXISTS integration_token_events CASCADE;
DROP TABLE IF EXISTS integration_tokens CASCADE;
DROP TABLE IF EXISTS org_security_policies CASCADE;
DROP TABLE IF EXISTS idempotency_keys CASCADE;
DROP TABLE IF EXISTS policy_results CASCADE;
DROP TABLE IF EXISTS policy_assignments CASCADE;
DROP TABLE IF EXISTS policy_rules CASCADE;
DROP TABLE IF EXISTS policies CASCADE;
DROP TABLE IF EXISTS product_asset_context CASCADE;
DROP TABLE IF EXISTS product_source_snapshots CASCADE;
DROP TABLE IF EXISTS product_team_roles CASCADE;
DROP TABLE IF EXISTS product_user_roles CASCADE;
DROP TABLE IF EXISTS risk_rescore_jobs CASCADE;
DROP TABLE IF EXISTS risk_recompute_cursors CASCADE;
DROP TABLE IF EXISTS risk_models CASCADE;
DROP TABLE IF EXISTS sla_settings CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS components CASCADE;
DROP TABLE IF EXISTS engagements CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS user_invitations CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS vuln_intel CASCADE;
DROP TABLE IF EXISTS bdu_identifier_map CASCADE;
DROP TABLE IF EXISTS bdu_vulnerabilities CASCADE;
DROP TABLE IF EXISTS bdu_sync_status CASCADE;

-- Drop extensions
DROP EXTENSION IF EXISTS pg_trgm;
DROP EXTENSION IF EXISTS pgcrypto;
