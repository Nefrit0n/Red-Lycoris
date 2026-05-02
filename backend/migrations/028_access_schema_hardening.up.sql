-- Stage 0 hardening for access-control foundation.

-- 1) groups.name should behave case-insensitively for uniqueness.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM groups g1
    JOIN groups g2
      ON g1.id <> g2.id
     AND lower(g1.name) = lower(g2.name)
  ) THEN
    RAISE EXCEPTION 'cannot enforce case-insensitive unique groups.name: duplicates found';
  END IF;
END;
$$;

DROP INDEX IF EXISTS idx_groups_name;
CREATE UNIQUE INDEX ux_groups_name_lower ON groups (lower(name));

-- 2) user_credentials invariants/indexes for lockout flows.
ALTER TABLE user_credentials
  ADD CONSTRAINT user_credentials_failed_attempts_nonnegative CHECK (failed_attempts >= 0),
  ADD CONSTRAINT user_credentials_must_change_reason_consistent CHECK (
    (must_change = true  AND must_change_reason IS NOT NULL) OR
    (must_change = false AND must_change_reason IS NULL)
  );

CREATE INDEX idx_user_credentials_locked_until
  ON user_credentials(locked_until)
  WHERE locked_until IS NOT NULL;

-- 3) Compatibility bridge between legacy users.global_role and user_roles.
CREATE OR REPLACE FUNCTION sync_users_global_role_to_user_roles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  desired_role_key TEXT;
  desired_role_id UUID;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  desired_role_key := CASE NEW.global_role WHEN 1 THEN 'admin' ELSE 'member' END;

  SELECT id INTO desired_role_id
  FROM roles
  WHERE key = desired_role_key;

  IF desired_role_id IS NULL THEN
    RAISE EXCEPTION 'required role % not found', desired_role_key;
  END IF;

  DELETE FROM user_roles
   WHERE user_id = NEW.id
     AND role_id IN (
       SELECT id FROM roles WHERE key IN ('admin', 'member')
     )
     AND role_id <> desired_role_id;

  INSERT INTO user_roles (user_id, role_id, granted_at, granted_by)
  VALUES (NEW.id, desired_role_id, COALESCE(NEW.updated_at, now()), NEW.created_by_user_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_user_roles_to_users_global_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_user_id UUID;
  has_admin_role BOOLEAN;
  desired_global_role SMALLINT;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  target_user_id := COALESCE(NEW.user_id, OLD.user_id);

  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = target_user_id
      AND r.key = 'admin'
  ) INTO has_admin_role;

  desired_global_role := CASE WHEN has_admin_role THEN 1 ELSE 0 END;

  UPDATE users
     SET global_role = desired_global_role,
         updated_at = now()
   WHERE id = target_user_id
     AND global_role <> desired_global_role;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_to_user_roles ON users;
CREATE TRIGGER trg_users_to_user_roles
AFTER INSERT OR UPDATE OF global_role ON users
FOR EACH ROW
EXECUTE FUNCTION sync_users_global_role_to_user_roles();

DROP TRIGGER IF EXISTS trg_user_roles_to_users ON user_roles;
CREATE TRIGGER trg_user_roles_to_users
AFTER INSERT OR DELETE OR UPDATE OF role_id ON user_roles
FOR EACH ROW
EXECUTE FUNCTION sync_user_roles_to_users_global_role();

-- Backfill consistency for existing rows.
INSERT INTO user_roles (user_id, role_id, granted_at)
SELECT u.id, r.id, u.created_at
FROM users u
JOIN roles r ON r.key = CASE u.global_role WHEN 1 THEN 'admin' ELSE 'member' END
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Ensure system account always has admin role.
INSERT INTO user_roles (user_id, role_id, granted_at)
SELECT u.id, r.id, now()
FROM users u
JOIN roles r ON r.key = 'admin'
WHERE u.is_system_account = true
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 4) project_access integrity/indexes.
CREATE OR REPLACE FUNCTION validate_project_access_subject()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.subject_kind = 'user' THEN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.subject_id) THEN
      RAISE EXCEPTION 'project_access subject_id % does not exist in users', NEW.subject_id;
    END IF;
  ELSIF NEW.subject_kind = 'group' THEN
    IF NOT EXISTS (SELECT 1 FROM groups WHERE id = NEW.subject_id) THEN
      RAISE EXCEPTION 'project_access subject_id % does not exist in groups', NEW.subject_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'unsupported subject_kind: %', NEW.subject_kind;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_access_validate_subject ON project_access;
CREATE TRIGGER trg_project_access_validate_subject
BEFORE INSERT OR UPDATE OF subject_kind, subject_id ON project_access
FOR EACH ROW
EXECUTE FUNCTION validate_project_access_subject();

CREATE INDEX idx_project_access_subject_project
  ON project_access(subject_kind, subject_id, project_id);

CREATE INDEX idx_project_access_project_kind_level
  ON project_access(project_id, subject_kind, access_level);

-- Validate existing rows against subject_kind/subject_id polymorphic FK rule.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM project_access pa
    WHERE (pa.subject_kind = 'user' AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = pa.subject_id))
       OR (pa.subject_kind = 'group' AND NOT EXISTS (SELECT 1 FROM groups g WHERE g.id = pa.subject_id))
  ) THEN
    RAISE EXCEPTION 'project_access contains dangling subject references';
  END IF;
END;
$$;
