ALTER TABLE sessions
  ADD COLUMN revoked_reason TEXT
    CONSTRAINT sessions_revoked_reason_check
    CHECK (revoked_reason IN (
      'user_logout', 'admin_revoke', 'password_changed',
      'role_changed', 'deactivated'
    ));

-- Индекс для быстрого поиска активных сессий пользователя
CREATE INDEX idx_sessions_user_active
  ON sessions(user_id, expires_at)
  WHERE revoked_at IS NULL;

-- MFA-факторы: таблица существует, TOTP реализуется в следующей итерации
CREATE TABLE mfa_factors (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT        NOT NULL
    CONSTRAINT mfa_factors_kind_check CHECK (kind IN ('totp', 'webauthn', 'recovery_code')),
  label        TEXT        NOT NULL DEFAULT '',
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_mfa_factors_user_id ON mfa_factors(user_id);
