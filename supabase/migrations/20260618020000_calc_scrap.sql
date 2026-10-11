-- ============================================================
-- 20260618020000_calc_scrap.sql  (QuotePro migration 038)
-- Production scrap/reject % applied to the whole piece cost.
-- ============================================================

ALTER TABLE calculations ADD COLUMN IF NOT EXISTS scrap_pct numeric NOT NULL DEFAULT 0;
