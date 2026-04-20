ALTER TABLE projects
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'workspace'
    CHECK (visibility IN ('private','team','workspace')),
  ADD COLUMN sla_critical_days      INT,
  ADD COLUMN sla_high_days          INT,
  ADD COLUMN sla_medium_days        INT,
  ADD COLUMN sla_low_days           INT,
  ADD COLUMN sla_notify_before_days INT NOT NULL DEFAULT 3;
