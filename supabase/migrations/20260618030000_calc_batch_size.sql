-- ============================================================
-- 20260618030000_calc_batch_size.sql  (QuotePro migration 039)
-- Optional batch/lot size. Setups repeat per batch: setups = ceil(qty / batch).
-- 0 = single setup for the whole order (legacy behaviour).
-- ============================================================

ALTER TABLE calculations ADD COLUMN IF NOT EXISTS batch_size numeric NOT NULL DEFAULT 0;
