DROP INDEX IF EXISTS idx_findings_sla_due_at;

ALTER TABLE findings
  DROP COLUMN IF EXISTS sla_due_at,
  DROP COLUMN IF EXISTS sla_breached,
  DROP COLUMN IF EXISTS sla_breached_at,
  DROP COLUMN IF EXISTS sla_profile,
  DROP COLUMN IF EXISTS sla_source;
