-- Add a username column to users for short display names
ALTER TABLE users
  ADD COLUMN username VARCHAR(64) NULL AFTER email,
  ADD UNIQUE KEY uniq_users_username (username);

