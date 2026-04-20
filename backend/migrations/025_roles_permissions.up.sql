CREATE TABLE roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  is_system   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  key         TEXT        PRIMARY KEY,
  resource    TEXT        NOT NULL,
  action      TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT ''
);

CREATE TABLE role_permissions (
  role_id        UUID NOT NULL REFERENCES roles(id)        ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE user_roles (
  user_id    UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  role_id    UUID        NOT NULL REFERENCES roles(id)  ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_id)
);

-- Системные роли
INSERT INTO roles (key, name, description, is_system) VALUES
  ('admin',   'Администратор', 'Полный доступ ко всей системе',                   true),
  ('auditor', 'Аудитор',       'Просмотр findings и аудита, экспорт',             true),
  ('member',  'Участник',      'Работа с findings в назначенных проектах',         true),
  ('viewer',  'Наблюдатель',   'Только просмотр в назначенных проектах',           true);

-- Права
INSERT INTO permissions (key, resource, action, description) VALUES
  ('users.manage',    'users',      'manage',  'Управление пользователями'),
  ('users.view',      'users',      'view',    'Просмотр пользователей'),
  ('groups.manage',   'groups',     'manage',  'Управление группами'),
  ('findings.write',  'findings',   'write',   'Создание и изменение findings'),
  ('findings.read',   'findings',   'read',    'Просмотр findings'),
  ('findings.triage', 'findings',   'triage',  'Триаж findings'),
  ('projects.manage', 'projects',   'manage',  'Управление проектами'),
  ('projects.read',   'projects',   'read',    'Просмотр проектов'),
  ('audit.view',      'audit',      'view',    'Просмотр аудит-лога'),
  ('export.run',      'export',     'run',     'Экспорт данных'),
  ('admin.access',    'admin',      'access',  'Доступ к панели администратора'),
  ('enrichment.view', 'enrichment', 'view',    'Просмотр статуса обогащения');

-- admin получает все права
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r CROSS JOIN permissions p
WHERE r.key = 'admin';

-- auditor: просмотр + аудит + экспорт
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r JOIN permissions p
  ON p.key IN ('findings.read', 'projects.read', 'audit.view',
               'export.run', 'enrichment.view', 'users.view')
WHERE r.key = 'auditor';

-- member: работа с findings
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r JOIN permissions p
  ON p.key IN ('findings.write', 'findings.read', 'findings.triage', 'projects.read')
WHERE r.key = 'member';

-- viewer: только чтение
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r JOIN permissions p
  ON p.key IN ('findings.read', 'projects.read')
WHERE r.key = 'viewer';

-- Data migration: global_role → user_roles
-- Admin (global_role=1) → admin; User (global_role=0) → member
INSERT INTO user_roles (user_id, role_id, granted_at)
SELECT
  u.id,
  r.id,
  u.created_at
FROM users u
JOIN roles r ON r.key = CASE u.global_role WHEN 1 THEN 'admin' ELSE 'member' END;

-- global_role в users оставляем для backward compat

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
