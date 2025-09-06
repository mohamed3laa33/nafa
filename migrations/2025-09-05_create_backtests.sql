-- Create backtests table for storing runs (idempotent)

SET @tbl_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'backtests'
);
SET @sql := IF(@tbl_exists = 0,
  'CREATE TABLE backtests (
     id CHAR(36) NOT NULL,
     strategy VARCHAR(64) NOT NULL,
     params JSON NULL,
     metrics JSON NOT NULL,
     equity_curve MEDIUMTEXT NULL,
     created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (id),
     INDEX idx_backtests_created (created_at)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

