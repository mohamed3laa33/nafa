-- Add sector column to stocks and index (idempotent)

-- sector VARCHAR(64) NULL AFTER market
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'stocks'
    AND column_name = 'sector'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE stocks ADD COLUMN sector VARCHAR(64) NULL AFTER market',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- index on sector
SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'stocks'
    AND index_name = 'idx_stocks_sector'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_stocks_sector ON stocks (sector)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

