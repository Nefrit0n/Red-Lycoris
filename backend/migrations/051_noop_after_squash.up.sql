-- Sync point after migration squash (001-050 → 001_baseline).
-- New installs: 001_baseline has the full schema, this is a noop.
-- Existing installs: migrations 001-050 were already applied.
SELECT 1;
