DROP TRIGGER IF EXISTS trg_sync_password_to_credentials ON users;
DROP FUNCTION IF EXISTS sync_password_to_credentials();
DROP TABLE IF EXISTS user_credentials;
