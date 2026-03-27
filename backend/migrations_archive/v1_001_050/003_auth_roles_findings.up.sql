CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

ALTER TABLE findings
    ALTER COLUMN scan_result_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';

UPDATE findings
SET status = 'new'
WHERE status IS NULL OR status = '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'findings_status_check'
    ) THEN
        ALTER TABLE findings
            ADD CONSTRAINT findings_status_check
            CHECK (status IN ('new', 'duplicate', 'resolved', 'ignored'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_findings_product_id ON findings (product_id);
CREATE INDEX IF NOT EXISTS idx_findings_deleted_at ON findings (deleted_at);
