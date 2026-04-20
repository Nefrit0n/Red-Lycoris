DROP INDEX IF EXISTS idx_mfa_factors_user_id;
DROP TABLE IF EXISTS mfa_factors;
DROP INDEX IF EXISTS idx_sessions_user_active;
ALTER TABLE sessions DROP COLUMN IF EXISTS revoked_reason;
