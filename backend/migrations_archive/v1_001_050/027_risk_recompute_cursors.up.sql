CREATE TABLE IF NOT EXISTS risk_recompute_cursors (
    tenant_id UUID NOT NULL,
    source TEXT NOT NULL,
    last_processed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, source)
);

CREATE INDEX IF NOT EXISTS idx_risk_recompute_cursors_source
    ON risk_recompute_cursors (source, last_processed_at);
