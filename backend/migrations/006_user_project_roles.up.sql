CREATE TABLE user_project_roles (
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role       SMALLINT    NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by UUID            REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, project_id)
);

CREATE INDEX idx_user_project_roles_project_role ON user_project_roles (project_id, role);
CREATE INDEX idx_user_project_roles_user_id ON user_project_roles (user_id);
