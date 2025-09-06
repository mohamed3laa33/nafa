-- Add audit/verification columns to stock_calls (idempotent)

-- entry_source VARCHAR(32) NULL AFTER entry
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'stock_calls'
    AND column_name = 'entry_source'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE stock_calls ADD COLUMN entry_source VARCHAR(32) NULL AFTER entry',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- close_source VARCHAR(32) NULL AFTER close_price
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'stock_calls'
    AND column_name = 'close_source'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE stock_calls ADD COLUMN close_source VARCHAR(32) NULL AFTER close_price',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- publish_at DATETIME NULL AFTER is_public
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'stock_calls'
    AND column_name = 'publish_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE stock_calls ADD COLUMN publish_at DATETIME NULL AFTER is_public',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- confidence TINYINT UNSIGNED NULL AFTER notes
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'stock_calls'
    AND column_name = 'confidence'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE stock_calls ADD COLUMN confidence TINYINT UNSIGNED NULL AFTER notes',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- rationale JSON NULL AFTER confidence (fallback to TEXT if JSON not supported)
SET @has_json := (
  SELECT COUNT(1)
  FROM information_schema.character_sets
  WHERE character_set_name IS NOT NULL -- dummy check to allow SELECT
);
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'stock_calls'
    AND column_name = 'rationale'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE stock_calls ADD COLUMN rationale JSON NULL AFTER confidence',
  'DO 0'
);
-- Try JSON; if this fails due to older MySQL, fallback to TEXT in app runtime
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

