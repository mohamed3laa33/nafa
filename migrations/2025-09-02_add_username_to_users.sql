-- Add column only if missing (MySQL-compatible)
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'username'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN username VARCHAR(64) NULL AFTER email',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add unique index if missing
SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND index_name = 'uniq_users_username'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE UNIQUE INDEX uniq_users_username ON users (username)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
