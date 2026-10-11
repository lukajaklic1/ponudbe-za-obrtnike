-- ============================================================
-- 20260615140000_machine_model.sql  (QuotePro migration 019)
-- Machine model/type label next to the name.
-- ============================================================

ALTER TABLE machines ADD COLUMN IF NOT EXISTS model text;
