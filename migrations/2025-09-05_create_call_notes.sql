-- Create call_notes table for immutable audit trail (idempotent)

SET @tbl_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'call_notes'
);
SET @sql := IF(@tbl_exists = 0,
  'CREATE TABLE call_notes (
     id CHAR(36) NOT NULL,
     call_id CHAR(36) NOT NULL,
     user_id CHAR(36) NOT NULL,
     note TEXT NULL,
     kind ENUM("note","edit","system") NOT NULL DEFAULT "note",
     created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (id),
     INDEX idx_call_notes_call_created (call_id, created_at),
     INDEX idx_call_notes_user_created (user_id, created_at)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

