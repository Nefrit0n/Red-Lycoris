CREATE TABLE user_credentials (
  user_id            UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash      TEXT        NOT NULL DEFAULT '',
  password_set_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  must_change        BOOLEAN     NOT NULL DEFAULT false,
  must_change_reason TEXT
    CONSTRAINT user_credentials_reason_check
    CHECK (must_change_reason IN ('initial', 'admin_reset', 'expiry')),
  failed_attempts    INT         NOT NULL DEFAULT 0,
  locked_until       TIMESTAMPTZ
);

-- Data migration: копируем хэши из users
INSERT INTO user_credentials (user_id, password_hash, password_set_at, must_change)
SELECT id, password_hash, created_at, false
FROM users;

-- Временный триггер-синхронизатор: пока auth-код читает users.password_hash,
-- держим user_credentials в актуальном состоянии при каждом UPDATE users.
CREATE OR REPLACE FUNCTION sync_password_to_credentials()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    UPDATE user_credentials
    SET password_hash   = NEW.password_hash,
        password_set_at = now()
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_password_to_credentials
AFTER UPDATE OF password_hash ON users
FOR EACH ROW EXECUTE FUNCTION sync_password_to_credentials();
