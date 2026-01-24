CREATE TABLE IF NOT EXISTS finding_risk (
    finding_id UUID PRIMARY KEY REFERENCES findings(id) ON DELETE CASCADE,
    tenant_id UUID,
    model_version TEXT NOT NULL,
    risk_score DOUBLE PRECISION NOT NULL,
    risk_band TEXT NOT NULL,
    factors JSONB NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL,
    input_hash TEXT NOT NULL,
    source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_finding_risk_tenant_score
    ON finding_risk (tenant_id, risk_score DESC);

CREATE INDEX IF NOT EXISTS idx_finding_risk_tenant_computed
    ON finding_risk (tenant_id, computed_at DESC);
