DROP TABLE IF EXISTS product_user_roles;
DROP TABLE IF EXISTS product_team_roles;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_tenant_id_id_unique;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tenant_id_id_unique;
