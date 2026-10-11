-- ============================================================
-- 20260615093000_quotes_items_calculations.sql  (QuotePro migration 012)
-- CREATE quotes → quote_items → calculations (1:1 per item).
-- ============================================================

-- ─── quotes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id   uuid NOT NULL REFERENCES customers(id),
  quote_number  text NOT NULL,                          -- QUO-2026-001
  title         text NOT NULL,                          -- naziv projekta / sklopa
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','won','lost','frozen')),
  lost_reason   text CHECK (lost_reason IN ('price','time','quality','competitor','other')),
  valid_until   date,
  delivery_date date,
  notes         text,
  created_by    uuid NOT NULL REFERENCES users(id),
  sent_at       timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_company  ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status   ON quotes(company_id, status);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage quotes"
ON quotes FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));

-- ─── quote_items (pieces within a quote) ────────────────────
CREATE TABLE IF NOT EXISTS quote_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 1,
  part_name   text NOT NULL,
  part_number text,
  quantity    integer NOT NULL DEFAULT 1,             -- letna količina kosov
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote   ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_company ON quote_items(company_id);

ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage quote items"
ON quote_items FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));

-- ─── calculations (exactly one per quote_item) ──────────────
CREATE TABLE IF NOT EXISTS calculations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_item_id         uuid NOT NULL UNIQUE REFERENCES quote_items(id) ON DELETE CASCADE,
  company_id            uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  version               integer NOT NULL DEFAULT 1,

  -- Cost sections (dynamic rows stored as JSONB arrays)
  raw_materials         jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{name,unit,qty_per_piece,price_per_unit,scrap_pct,total}]
  purchased_parts       jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{name,supplier,unit,qty_per_piece,price_per_unit,total}]
  processes             jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ref_type,ref_id,name,hourly_rate,setup_min,cycle_min,total}]
  tooling               jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{name,tool_cost,lifetime_pcs,cost_per_piece}]
  investments           jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{name,value,utilization_pct,...,total_per_piece}]
  packaging             jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{name,qty_per_piece,price_per_unit,total}]

  -- Overhead snapshots (editable per item)
  oh_material_pct       numeric(5,2) NOT NULL DEFAULT 0,
  oh_mfg_pct            numeric(5,2) NOT NULL DEFAULT 0,
  oh_sga_pct            numeric(5,2) NOT NULL DEFAULT 0,
  oh_logistics_pct      numeric(5,2) NOT NULL DEFAULT 0,
  oh_rd_pct             numeric(5,2) NOT NULL DEFAULT 0,
  profit_pct            numeric(5,2) NOT NULL DEFAULT 15,

  -- Computed totals (stored for PDF / reporting)
  total_raw_materials   numeric(12,4) NOT NULL DEFAULT 0,
  total_purchased_parts numeric(12,4) NOT NULL DEFAULT 0,
  total_processes       numeric(12,4) NOT NULL DEFAULT 0,
  total_tooling         numeric(12,4) NOT NULL DEFAULT 0,
  total_investments     numeric(12,4) NOT NULL DEFAULT 0,
  total_packaging       numeric(12,4) NOT NULL DEFAULT 0,
  total_overhead        numeric(12,4) NOT NULL DEFAULT 0,
  cost_per_piece        numeric(12,4) NOT NULL DEFAULT 0,    -- lastna cena/kos (brez marže)
  selling_price         numeric(12,4) NOT NULL DEFAULT 0,    -- prodajna cena/kos (z maržo)
  annual_value          numeric(12,2) NOT NULL DEFAULT 0,    -- selling_price × quantity

  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calculations_company ON calculations(company_id);

ALTER TABLE calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage calculations"
ON calculations FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));
