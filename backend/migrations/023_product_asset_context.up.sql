CREATE TABLE IF NOT EXISTS product_asset_context (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tenant_id UUID,
    environment TEXT NOT NULL DEFAULT 'unknown',
    internet_exposed BOOLEAN NOT NULL DEFAULT false,
    data_classification TEXT NOT NULL DEFAULT 'unknown',
    business_impact TEXT NULL,
    tags TEXT[] NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, product_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_asset_context_environment_check'
    ) THEN
        ALTER TABLE product_asset_context
            ADD CONSTRAINT product_asset_context_environment_check
            CHECK (environment IN ('prod', 'staging', 'dev', 'unknown'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_asset_context_data_classification_check'
    ) THEN
        ALTER TABLE product_asset_context
            ADD CONSTRAINT product_asset_context_data_classification_check
            CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted', 'unknown'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_asset_context_business_impact_check'
    ) THEN
        ALTER TABLE product_asset_context
            ADD CONSTRAINT product_asset_context_business_impact_check
            CHECK (business_impact IS NULL OR business_impact IN ('low', 'medium', 'high', 'critical'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_asset_context_tenant_product
    ON product_asset_context (tenant_id, product_id);

CREATE INDEX IF NOT EXISTS idx_product_asset_context_tenant_exposed
    ON product_asset_context (tenant_id, internet_exposed);

CREATE INDEX IF NOT EXISTS idx_product_asset_context_tenant_business_impact
    ON product_asset_context (tenant_id, business_impact);
