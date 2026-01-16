DELETE FROM user_roles
WHERE user_id IN (SELECT id FROM users WHERE username = 'root')
  AND role_id IN (SELECT id FROM roles WHERE name = 'root');

DELETE FROM users WHERE username = 'root';
DELETE FROM roles WHERE name = 'root';