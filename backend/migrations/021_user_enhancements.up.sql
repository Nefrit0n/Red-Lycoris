ALTER TABLE users
  ADD COLUMN status             TEXT        NOT NULL DEFAULT 'active'
    CONSTRAINT users_status_check CHECK (status IN ('active', 'pending', 'disabled')),
  ADD COLUMN is_system_account  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN created_by_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN last_login_ip      INET;

-- Data migration: is_active=false → status=disabled
UPDATE users SET status = 'disabled' WHERE NOT is_active;

-- Mark bootstrap system account: самый ранний admin, созданный без явного создателя
-- (created_by_user_id = NULL, потому что мы его только добавили)
-- Это единственный admin, существовавший до появления аудита создания юзеров
UPDATE users
SET is_system_account = true
WHERE id = (
  SELECT id FROM users
  WHERE global_role = 1
  ORDER BY created_at ASC
  LIMIT 1
);

-- is_active оставляем: старый код auth middleware читает его, убираем в более поздней миграции

CREATE INDEX idx_users_status         ON users(status);
CREATE INDEX idx_users_system_account ON users(is_system_account)
  WHERE is_system_account = true;
