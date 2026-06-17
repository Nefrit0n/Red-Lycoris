ALTER TABLE projects
  DROP COLUMN IF EXISTS autoscan_on_push,
  DROP COLUMN IF EXISTS default_branch,
  DROP COLUMN IF EXISTS source_kind;
