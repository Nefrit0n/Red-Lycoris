-- Revert stage 0 hardening migration.

DROP INDEX IF EXISTS idx_project_access_project_kind_level;
DROP INDEX IF EXISTS idx_project_access_subject_project;

DROP TRIGGER IF EXISTS trg_project_access_validate_subject ON project_access;
DROP FUNCTION IF EXISTS validate_project_access_subject();

DROP TRIGGER IF EXISTS trg_user_roles_to_users ON user_roles;
DROP TRIGGER IF EXISTS trg_users_to_user_roles ON users;
DROP FUNCTION IF EXISTS sync_user_roles_to_users_global_role();
DROP FUNCTION IF EXISTS sync_users_global_role_to_user_roles();

DROP INDEX IF EXISTS idx_user_credentials_locked_until;

ALTER TABLE user_credentials
  DROP CONSTRAINT IF EXISTS user_credentials_must_change_reason_consistent,
  DROP CONSTRAINT IF EXISTS user_credentials_failed_attempts_nonnegative;

DROP INDEX IF EXISTS ux_groups_name_lower;
CREATE INDEX idx_groups_name ON groups(name);
