-- ============================================================
-- 20260615100000_machine_rate_detail.sql  (QuotePro migration 015)
-- Extend machines with full TCE-style hourly-rate cost model.
-- ============================================================

-- Capacity
ALTER TABLE machines ADD COLUMN IF NOT EXISTS production_days_per_year numeric(6,1) NOT NULL DEFAULT 240;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS shifts_per_day           numeric(4,1) NOT NULL DEFAULT 1;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS hours_per_shift          numeric(5,2) NOT NULL DEFAULT 8;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS break_min_per_shift      numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS utilization_pct          numeric(5,2) NOT NULL DEFAULT 85;

-- Investments (acquisition_value already exists)
ALTER TABLE machines ADD COLUMN IF NOT EXISTS installation_cost numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS foundation_cost   numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS additional_cost   numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS residual_value    numeric(12,2) NOT NULL DEFAULT 0;

-- Variable cost inputs (interest/insurance/space + depreciation_years already exist)
ALTER TABLE machines ADD COLUMN IF NOT EXISTS maintenance_pct          numeric(5,2)  NOT NULL DEFAULT 0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS power_production_kw      numeric(8,2)  NOT NULL DEFAULT 0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS power_standby_kw         numeric(8,2)  NOT NULL DEFAULT 0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS electricity_cost_per_kwh numeric(8,4)  NOT NULL DEFAULT 0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS tooling_cost_per_year    numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS consumables_cost_per_year numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS other_variable_per_year  numeric(12,2) NOT NULL DEFAULT 0;
