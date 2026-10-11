-- ============================================================
-- 20260615130000_labor_rates.sql  (QuotePro migration 018)
-- Labour hourly-rate definitions (operator cost ÷ net hours).
-- ============================================================

CREATE TABLE IF NOT EXISTS labor_rates (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                     text NOT NULL,                 -- operator title
  annual_cost              numeric(12,2) NOT NULL DEFAULT 0,
  working_days_per_year    numeric(6,1)  NOT NULL DEFAULT 240,
  vacation_days            numeric(6,1)  NOT NULL DEFAULT 30,
  shifts_per_day           numeric(4,1)  NOT NULL DEFAULT 1,
  hours_per_shift          numeric(5,2)  NOT NULL DEFAULT 8,
  break_min_per_shift      numeric(6,2)  NOT NULL DEFAULT 0,
  utilization_pct          numeric(5,2)  NOT NULL DEFAULT 85,
  hourly_rate_computed     numeric(10,2),
  is_active                boolean NOT NULL DEFAULT true,
  notes                    text,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_labor_rates_company ON labor_rates(company_id);

ALTER TABLE labor_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage labor rates"
ON labor_rates FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));
