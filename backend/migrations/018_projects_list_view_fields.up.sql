ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS slug TEXT,
    ADD COLUMN IF NOT EXISTS icon_color TEXT NOT NULL DEFAULT '#64748b',
    ADD COLUMN IF NOT EXISTS repo_url TEXT,
    ADD COLUMN IF NOT EXISTS repo_provider TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE projects
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

UPDATE projects
SET slug = trim(both '-' from slug)
WHERE slug IS NOT NULL;

UPDATE projects
SET slug = 'project-' || substring(id::text, 1, 8)
WHERE slug IS NULL OR slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug_unique ON projects (slug);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_pinned_id ON projects (pinned DESC, id DESC);
