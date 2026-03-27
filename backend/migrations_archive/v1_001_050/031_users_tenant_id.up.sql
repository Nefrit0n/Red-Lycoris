-- Migration to add tenant_id column to users table
-- This ensures users are associated with a tenant for proper multi-tenant support

-- Add tenant_id column to users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Set default tenant for all existing users
UPDATE users SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;

-- Make tenant_id NOT NULL after setting default values
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;

-- Set default for new users
ALTER TABLE users ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- Create index for tenant_id lookups
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);

-- Add comment for documentation
COMMENT ON COLUMN users.tenant_id IS 'Tenant UUID - required for multi-tenant isolation';
