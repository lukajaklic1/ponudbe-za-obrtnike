-- ============================================================
-- 20260618010000_calc_quantities.sql  (QuotePro migration 037)
-- Support up to 3 quote quantities per calculation (price breaks).
-- quantities[0] stays the primary qty (mirrors quote_items.quantity);
-- the existing cost_per_piece/selling_price/annual_value reflect the primary.
-- ============================================================

ALTER TABLE calculations ADD COLUMN IF NOT EXISTS quantities jsonb NOT NULL DEFAULT '[]'::jsonb;
