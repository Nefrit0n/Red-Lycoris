-- Align access-control schema with user/group/project matrix requirements.

ALTER TABLE groups
  ALTER COLUMN name TYPE VARCHAR(64),
  ALTER COLUMN description TYPE VARCHAR(512),
  ALTER COLUMN color_key TYPE VARCHAR(32),
  ALTER COLUMN source TYPE VARCHAR(16);

ALTER TABLE user_groups
  RENAME COLUMN added_by TO added_by_user_id;

DROP TRIGGER IF EXISTS trg_project_access_validate_subject ON project_access;

ALTER TABLE project_access
  ALTER COLUMN subject_kind TYPE VARCHAR(8),
  ALTER COLUMN access_level TYPE VARCHAR(8);

-- Canonical permissions used by access management UI.
INSERT INTO permissions (key, resource, action, description) VALUES
  ('audit.read', 'audit', 'read', 'Просмотр журнала аудита'),
  ('reports.read', 'reports', 'read', 'Просмотр отчётов')
ON CONFLICT (key) DO UPDATE
SET resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    description = EXCLUDED.description;

-- Keep backward-compatible alias permission if present.
INSERT INTO permissions (key, resource, action, description)
VALUES ('audit.view', 'audit', 'view', 'Просмотр журнала аудита (legacy alias)')
ON CONFLICT (key) DO NOTHING;

-- Rebuild role mappings for system roles according to the target matrix.
DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE key IN ('admin', 'auditor', 'member', 'viewer'));

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'admin';

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r
JOIN permissions p ON p.key IN ('findings.read', 'audit.read', 'reports.read', 'projects.read')
WHERE r.key = 'auditor';

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r
JOIN permissions p ON p.key IN ('findings.read', 'findings.write', 'projects.read', 'reports.read')
WHERE r.key = 'member';

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r
JOIN permissions p ON p.key IN ('findings.read', 'projects.read', 'reports.read')
WHERE r.key = 'viewer';

CREATE TRIGGER trg_project_access_validate_subject
BEFORE INSERT OR UPDATE OF subject_kind, subject_id ON project_access
FOR EACH ROW
EXECUTE FUNCTION validate_project_access_subject();

CREATE INDEX IF NOT EXISTS idx_project_access_project_subject ON project_access(project_id, subject_kind, subject_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);
