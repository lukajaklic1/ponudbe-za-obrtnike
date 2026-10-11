-- ============================================================
-- 20260615110000_machine_energy_media.sql  (QuotePro migration 016)
-- Flexible energy/media list per machine (electricity, gas, water,
-- compressed air, steam…): [{name, unit, price_per_unit, consumption_per_h}].
-- ============================================================

ALTER TABLE machines ADD COLUMN IF NOT EXISTS energy_media jsonb NOT NULL DEFAULT '[]'::jsonb;
