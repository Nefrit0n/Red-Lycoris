DROP INDEX IF EXISTS idx_permissions_resource_action;
DROP INDEX IF EXISTS idx_role_permissions_role;
DROP INDEX IF EXISTS idx_project_access_project_subject;

DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE key IN ('admin', 'auditor', 'member', 'viewer'));

-- Rollback to previous seed policy.
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r
JOIN permissions p ON p.key IN (
  'findings.read','projects.read','audit.view','export.run','enrichment.view','users.view'
)
WHERE r.key = 'auditor'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r
JOIN permissions p ON p.key IN ('findings.write','findings.read','findings.triage','projects.read')
WHERE r.key = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r
JOIN permissions p ON p.key IN ('findings.read','projects.read')
WHERE r.key = 'viewer'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'admin'
ON CONFLICT DO NOTHING;

DELETE FROM permissions WHERE key IN ('audit.read', 'reports.read');

DROP TRIGGER IF EXISTS trg_project_access_validate_subject ON project_access;

ALTER TABLE project_access
  ALTER COLUMN subject_kind TYPE TEXT,
  ALTER COLUMN access_level TYPE TEXT;

ALTER TABLE user_groups
  RENAME COLUMN added_by_user_id TO added_by;

ALTER TABLE groups
  ALTER COLUMN name TYPE TEXT,
  ALTER COLUMN description TYPE TEXT,
  ALTER COLUMN color_key TYPE TEXT,
  ALTER COLUMN source TYPE TEXT;

CREATE TRIGGER trg_project_access_validate_subject
BEFORE INSERT OR UPDATE OF subject_kind, subject_id ON project_access
FOR EACH ROW
EXECUTE FUNCTION validate_project_access_subject();
