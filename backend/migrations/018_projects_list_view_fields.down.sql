DROP INDEX IF EXISTS idx_projects_pinned_id;
DROP INDEX IF EXISTS idx_projects_status;
DROP INDEX IF EXISTS idx_projects_slug_unique;

ALTER TABLE projects
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS pinned,
    DROP COLUMN IF EXISTS setup_completed,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS repo_provider,
    DROP COLUMN IF EXISTS repo_url,
    DROP COLUMN IF EXISTS icon_color,
    DROP COLUMN IF EXISTS slug;
