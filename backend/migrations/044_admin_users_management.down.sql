DROP INDEX IF EXISTS idx_user_invitations_tenant_email;
DROP INDEX IF EXISTS idx_user_invitations_tenant_created;
DROP TABLE IF EXISTS user_invitations;

DROP INDEX IF EXISTS idx_users_tenant_org_role_created;
DROP INDEX IF EXISTS idx_users_tenant_status_created;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_role_check;

ALTER TABLE users
    DROP COLUMN IF EXISTS deactivated_at,
    DROP COLUMN IF EXISTS last_login_at,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS org_role,
    DROP COLUMN IF EXISTS full_name;
