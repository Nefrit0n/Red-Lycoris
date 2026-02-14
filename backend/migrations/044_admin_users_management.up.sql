ALTER TABLE users
    ADD COLUMN IF NOT EXISTS full_name TEXT,
    ADD COLUMN IF NOT EXISTS org_role TEXT NOT NULL DEFAULT 'viewer',
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_org_role_check'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_org_role_check
            CHECK (org_role IN ('owner', 'admin', 'security_manager', 'viewer'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_status_check
            CHECK (status IN ('active', 'deactivated', 'invited'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_tenant_status_created
    ON users (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_tenant_org_role_created
    ON users (tenant_id, org_role, created_at DESC);

CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    email TEXT NOT NULL,
    full_name TEXT,
    org_role TEXT NOT NULL CHECK (org_role IN ('owner', 'admin', 'security_manager', 'viewer')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled')),
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE (tenant_id, email, status)
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_tenant_created
    ON user_invitations (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_invitations_tenant_email
    ON user_invitations (tenant_id, email);
