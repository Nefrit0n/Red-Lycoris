ALTER TABLE audit_log
    ADD COLUMN IF NOT EXISTS trace_id TEXT,
    ADD COLUMN IF NOT EXISTS session_id TEXT,
    ADD COLUMN IF NOT EXISTS full_path TEXT,
    ADD COLUMN IF NOT EXISTS ua_browser TEXT,
    ADD COLUMN IF NOT EXISTS ua_os TEXT,
    ADD COLUMN IF NOT EXISTS ua_is_tor BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ua_is_vpn BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ua_is_datacenter BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ua_country_code TEXT,
    ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'low',
    ADD COLUMN IF NOT EXISTS risk_signals TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS integrity_hash TEXT,
    ADD COLUMN IF NOT EXISTS integrity_prev_hash TEXT,
    ADD COLUMN IF NOT EXISTS integrity_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS changes JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_audit_log_trace_id ON audit_log (trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_session_id ON audit_log (session_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_risk_level ON audit_log (risk_level);
CREATE INDEX IF NOT EXISTS idx_audit_log_status_code ON audit_log (status_code);
CREATE INDEX IF NOT EXISTS idx_audit_log_method ON audit_log (method);
