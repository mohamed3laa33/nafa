-- Adds public visibility to stock calls
ALTER TABLE stock_calls
  ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 AFTER notes;

