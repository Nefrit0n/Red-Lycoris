ALTER TABLE findings
  ADD COLUMN sla_due_at TIMESTAMPTZ NULL,
  ADD COLUMN sla_breached BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN sla_breached_at TIMESTAMPTZ NULL,
  ADD COLUMN sla_profile TEXT NULL,
  ADD COLUMN sla_source TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_findings_sla_due_at
  ON findings (sla_due_at)
  WHERE sla_due_at IS NOT NULL AND sla_breached = false;
