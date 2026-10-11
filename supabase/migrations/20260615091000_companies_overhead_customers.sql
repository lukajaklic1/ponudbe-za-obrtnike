-- ============================================================
-- 20260615091000_companies_overhead_customers.sql  (QuotePro migration 010)
-- ALTER companies: 7 overhead/quote columns.
-- CREATE customers (replaces suppliers).
-- ============================================================

-- ─── companies: overhead defaults + quote counter ───────────
ALTER TABLE companies ADD COLUMN IF NOT EXISTS overhead_material_pct  numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS overhead_mfg_pct       numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS overhead_sga_pct       numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS overhead_logistics_pct numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS overhead_rd_pct        numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS overhead_profit_pct    numeric(5,2) NOT NULL DEFAULT 15;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS quote_counter          integer      NOT NULL DEFAULT 0;

-- ─── customers ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name           text NOT NULL,
  contact_person text,
  email          text,
  phone          text,
  address        text,
  vat_number     text,
  country        text,                       -- ISO code: SI, HR, AT...
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage customers"
ON customers FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));
