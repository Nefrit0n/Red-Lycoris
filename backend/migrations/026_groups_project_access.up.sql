CREATE TABLE groups (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL,
  description        TEXT        NOT NULL DEFAULT '',
  -- Ключ в детерминированной палитре из 8 цветов (0-7)
  color_key          TEXT        NOT NULL DEFAULT '0',
  source             TEXT        NOT NULL DEFAULT 'manual'
    CONSTRAINT groups_source_check CHECK (source IN ('manual', 'ldap_sync')),
  -- DN группы в LDAP (заполняется при ldap_sync)
  external_id        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE TABLE user_groups (
  user_id  UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  group_id UUID        NOT NULL REFERENCES groups(id)  ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, group_id)
);

-- Единая таблица доступов к проектам: субъект = группа ИЛИ прямой юзер
CREATE TABLE project_access (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  subject_kind       TEXT        NOT NULL
    CONSTRAINT project_access_subject_kind_check CHECK (subject_kind IN ('group', 'user')),
  subject_id         UUID        NOT NULL,
  access_level       TEXT        NOT NULL
    CONSTRAINT project_access_level_check CHECK (access_level IN ('read', 'write', 'admin')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (project_id, subject_kind, subject_id)
);

-- Data migration: user_project_roles → project_access
-- Viewer(0)→read, Triager(1)→write, ProjectAdmin(2)→admin
INSERT INTO project_access (project_id, subject_kind, subject_id, access_level, created_at, created_by_user_id)
SELECT
  project_id,
  'user',
  user_id,
  CASE role
    WHEN 0 THEN 'read'
    WHEN 1 THEN 'write'
    WHEN 2 THEN 'admin'
  END,
  granted_at,
  granted_by
FROM user_project_roles;

-- user_project_roles оставляем: старые эндпоинты /projects/{id}/members
-- продолжают работать через неё до Этапов 8-9

CREATE INDEX idx_project_access_project ON project_access(project_id);
CREATE INDEX idx_project_access_subject ON project_access(subject_kind, subject_id);
CREATE INDEX idx_user_groups_user_id    ON user_groups(user_id);
CREATE INDEX idx_user_groups_group_id   ON user_groups(group_id);
CREATE INDEX idx_groups_name            ON groups(name);
CREATE INDEX idx_groups_source          ON groups(source);
