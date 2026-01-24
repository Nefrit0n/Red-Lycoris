CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS risk_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NULL,
    version TEXT NOT NULL,
    name TEXT NOT NULL,
    weights JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_models_tenant_version
    ON risk_models (tenant_id, version);

CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_models_active_tenant
    ON risk_models (tenant_id)
    WHERE is_active;
