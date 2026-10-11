-- ============================================================
-- 20260615160000_labor_updated_by.sql  (QuotePro migration 021)
-- Track who last saved a labour rate.
-- ============================================================

ALTER TABLE labor_rates ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id);
