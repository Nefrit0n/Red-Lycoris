CREATE TABLE user_identities (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT        NOT NULL
    CONSTRAINT user_identities_kind_check CHECK (kind IN ('local', 'ldap', 'ad', 'oidc')),
  provider_id  TEXT        NOT NULL DEFAULT 'local',
  external_id  TEXT,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, provider_id)
);

-- Data migration: все существующие юзеры — local-идентичность
INSERT INTO user_identities (user_id, kind, provider_id, last_used_at)
SELECT id, 'local', 'local', last_login_at
FROM users;

CREATE INDEX idx_user_identities_user_id ON user_identities(user_id);
CREATE INDEX idx_user_identities_kind    ON user_identities(kind);
