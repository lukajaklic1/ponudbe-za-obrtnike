-- ============================================================
-- 20260615230000_materials.sql  (QuotePro migration 028)
-- Global material database: density + price/kg. Weight is
-- derived from shape + dimensions in the quote calculator.
-- ============================================================

CREATE TABLE IF NOT EXISTS materials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text NOT NULL,                 -- e.g. S235, Al 6082, SS304
  category     text,                          -- steel / aluminium / stainless / plastic / other
  density      numeric(8,3) NOT NULL DEFAULT 0,   -- g/cm³
  price_per_kg numeric(12,4) NOT NULL DEFAULT 0,  -- €/kg
  color        text,                          -- hex for UI chip
  is_active    boolean NOT NULL DEFAULT true,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materials_company ON materials(company_id);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage materials"
ON materials FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));
