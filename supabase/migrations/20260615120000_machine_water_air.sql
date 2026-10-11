-- ============================================================
-- 20260615120000_machine_water_air.sql  (QuotePro migration 017)
-- Fixed variable-cost fields for water and compressed air (€/year).
-- ============================================================

ALTER TABLE machines ADD COLUMN IF NOT EXISTS water_cost_per_year         numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS compressed_air_cost_per_year numeric(12,2) NOT NULL DEFAULT 0;
