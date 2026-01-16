INSERT INTO roles (name)
VALUES ('admin')
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (username, email, hashed_password)
VALUES ('root', 'root@localhost', '$2a$10$5TJfITBcwFhSMFyvNFT9teh5bM8FB3Dl.UpWAn3GSGoDrP/n8AKcG')
ON CONFLICT DO NOTHING;

WITH admin_role AS (
    SELECT id FROM roles WHERE name = 'admin'
), root_user AS (
    SELECT id FROM users WHERE username = 'root'
)
INSERT INTO user_roles (user_id, role_id)
SELECT root_user.id, admin_role.id
FROM root_user, admin_role
ON CONFLICT DO NOTHING;
