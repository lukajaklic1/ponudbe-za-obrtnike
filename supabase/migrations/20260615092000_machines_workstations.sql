-- ============================================================
-- 20260615092000_machines_workstations.sql  (QuotePro migration 011)
-- CREATE machines (hourly-rate base) + workstations (manual labour).
-- ============================================================

-- ─── machines ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS machines (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  category             text,                          -- cnc / injection / pressing / welding / laser / other
  acquisition_value    numeric(12,2),                 -- nabavna vrednost
  depreciation_years   numeric(5,1),                  -- amortizacijska doba (leta)
  interest_rate_pct    numeric(5,2),                  -- obresti %/leto
  insurance_rate_pct   numeric(5,2),                  -- zavarovanje %/leto
  space_m2             numeric(6,2),                  -- površina stroja
  space_cost_per_m2    numeric(8,2),                  -- €/m²/mesec
  hourly_rate_manual   numeric(10,2),                 -- ročni vnos €/h (če use_manual_rate)
  use_manual_rate      boolean NOT NULL DEFAULT true,  -- true = ročni vnos, false = izračun
  hourly_rate_computed numeric(10,2),                 -- izračunana €/h (računa in shrani app)
  is_active            boolean NOT NULL DEFAULT true,  -- soft delete
  notes                text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_machines_company ON machines(company_id);

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage machines"
ON machines FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));

-- ─── workstations ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workstations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,                 -- Montaža, Kontrola kakovosti, Pakiranje...
  hourly_rate numeric(10,2) NOT NULL,        -- €/h (ročni vnos)
  is_active   boolean NOT NULL DEFAULT true,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workstations_company ON workstations(company_id);

ALTER TABLE workstations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage workstations"
ON workstations FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));
