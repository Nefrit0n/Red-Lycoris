CREATE TABLE IF NOT EXISTS sla_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    product_id UUID NULL REFERENCES products(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    critical_days INT NOT NULL,
    high_days INT NOT NULL,
    medium_days INT NOT NULL,
    low_days INT NOT NULL,
    due_soon_days INT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT sla_settings_days_range CHECK (
        critical_days BETWEEN 1 AND 3650
        AND high_days BETWEEN 1 AND 3650
        AND medium_days BETWEEN 1 AND 3650
        AND low_days BETWEEN 1 AND 3650
        AND due_soon_days BETWEEN 1 AND 3650
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sla_settings_tenant_product
    ON sla_settings(tenant_id, product_id)
    WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_sla_settings_tenant_org_default
    ON sla_settings(tenant_id)
    WHERE product_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_sla_settings_tenant_id ON sla_settings(tenant_id);
