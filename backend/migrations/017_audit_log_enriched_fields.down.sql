DROP INDEX IF EXISTS idx_audit_log_method;
DROP INDEX IF EXISTS idx_audit_log_status_code;
DROP INDEX IF EXISTS idx_audit_log_risk_level;
DROP INDEX IF EXISTS idx_audit_log_session_id;
DROP INDEX IF EXISTS idx_audit_log_trace_id;

ALTER TABLE audit_log
    DROP COLUMN IF EXISTS changes,
    DROP COLUMN IF EXISTS integrity_verified,
    DROP COLUMN IF EXISTS integrity_prev_hash,
    DROP COLUMN IF EXISTS integrity_hash,
    DROP COLUMN IF EXISTS risk_signals,
    DROP COLUMN IF EXISTS risk_level,
    DROP COLUMN IF EXISTS ua_country_code,
    DROP COLUMN IF EXISTS ua_is_datacenter,
    DROP COLUMN IF EXISTS ua_is_vpn,
    DROP COLUMN IF EXISTS ua_is_tor,
    DROP COLUMN IF EXISTS ua_os,
    DROP COLUMN IF EXISTS ua_browser,
    DROP COLUMN IF EXISTS full_path,
    DROP COLUMN IF EXISTS session_id,
    DROP COLUMN IF EXISTS trace_id;
