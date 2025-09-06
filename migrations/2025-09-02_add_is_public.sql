-- Add column only if missing (MySQL-compatible)
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'stock_calls'
    AND column_name = 'is_public'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE stock_calls ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 AFTER notes',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
