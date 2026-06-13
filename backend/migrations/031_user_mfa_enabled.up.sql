-- Add mfa_enabled column to users table.
-- mfa_factors table always empty (no TOTP implemented yet), so all rows backfill to false.
ALTER TABLE users ADD COLUMN mfa_enabled BOOL NOT NULL DEFAULT false;

UPDATE users u
SET mfa_enabled = EXISTS(SELECT 1 FROM mfa_factors mf WHERE mf.user_id = u.id);
