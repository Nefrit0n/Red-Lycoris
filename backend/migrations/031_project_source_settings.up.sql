ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_kind IN ('manual','git','sarif','webhook')),
  ADD COLUMN IF NOT EXISTS default_branch TEXT NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS autoscan_on_push BOOLEAN NOT NULL DEFAULT false;

UPDATE projects
SET source_kind = 'git',
    default_branch = COALESCE(NULLIF(default_branch, ''), 'main'),
    autoscan_on_push = true
WHERE repo_url IS NOT NULL
  AND btrim(repo_url) <> '';
