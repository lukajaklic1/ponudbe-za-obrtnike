-- ============================================================
-- 20260615150000_machine_updated_by.sql  (QuotePro migration 020)
-- Track who last saved a machine.
-- ============================================================

ALTER TABLE machines ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id);
