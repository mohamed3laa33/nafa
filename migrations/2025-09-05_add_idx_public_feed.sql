-- Indexes to speed up public feed queries (idempotent)

-- Composite index on public calls by status/time
SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'stock_calls'
    AND index_name = 'idx_calls_public_time'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_calls_public_time ON stock_calls (is_public, status, opened_at DESC, id)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

