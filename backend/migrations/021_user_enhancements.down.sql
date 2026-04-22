DROP INDEX IF EXISTS idx_users_system_account;
DROP INDEX IF EXISTS idx_users_status;

ALTER TABLE users
  DROP COLUMN IF EXISTS last_login_ip,
  DROP COLUMN IF EXISTS created_by_user_id,
  DROP COLUMN IF EXISTS is_system_account,
  DROP COLUMN IF EXISTS status;
