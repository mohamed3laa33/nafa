-- Cache table for sector EV/Sales medians (idempotent)

SET @tbl_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'sector_medians'
);
SET @sql := IF(@tbl_exists = 0,
  'CREATE TABLE sector_medians (
     sector VARCHAR(64) NOT NULL,
     ev_sales_median DECIMAL(10,4) NOT NULL,
     updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     PRIMARY KEY (sector)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

