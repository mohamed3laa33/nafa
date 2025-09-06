-- Add a covering index for keyset pagination and common filters (idempotent, MySQL-compatible)
-- Covers: opened_by_user_id, status, outcome, then ordering by opened_at DESC, id
SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'stock_calls'
    AND index_name = 'idx_calls_view'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_calls_view ON stock_calls (opened_by_user_id, status, outcome, opened_at DESC, id)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEallocate PREPARE stmt;

-- Note:
-- - stocks already has UNIQUE(ticker, market) which covers ticker lookups.
-- - follows already has PRIMARY KEY(follower_id, following_id) which covers joins.
