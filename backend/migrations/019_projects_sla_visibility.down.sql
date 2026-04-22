ALTER TABLE projects
  DROP COLUMN IF EXISTS visibility,
  DROP COLUMN IF EXISTS sla_critical_days,
  DROP COLUMN IF EXISTS sla_high_days,
  DROP COLUMN IF EXISTS sla_medium_days,
  DROP COLUMN IF EXISTS sla_low_days,
  DROP COLUMN IF EXISTS sla_notify_before_days;
