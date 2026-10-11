-- Obrtdesk namestitev — KORAK 3 od 6
-- Samo za PRAZEN Supabase projekt. Prilepi celoto v SQL Editor in klikni Run.
-- vsebuje: 20260614080000_allow_over_receipt.sql … 20260622000000_dashboard_kpi.sql

-- ===== 20260614080000_allow_over_receipt.sql =====
-- ============================================================
-- 20260614080000_allow_over_receipt.sql
-- Allow over-delivery (received may exceed ordered).
-- ============================================================

CREATE OR REPLACE FUNCTION create_receipt(
  p_po_id uuid, p_received_date date, p_supplier_receipt_no text, p_note text, p_lines jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid; v_po purchase_orders%ROWTYPE; v_num text; v_receipt_id uuid;
  v_line jsonb; v_po_line uuid; v_qty numeric; v_rej numeric; v_ordered numeric;
  v_recv_status text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;
  IF v_po.id IS NULL THEN RAISE EXCEPTION 'PO not found'; END IF;
  IF v_po.company_id <> get_my_company_id() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_po.status <> 'sent' THEN RAISE EXCEPTION 'Only sent orders can be received'; END IF;
  IF NOT (has_perm('receipts', 'create') OR is_my_admin()) THEN RAISE EXCEPTION 'No permission to receive'; END IF;

  v_num := generate_receipt_number(v_po.company_id);
  INSERT INTO receipts (company_id, po_id, receipt_number, received_by, received_date, supplier_receipt_no, note)
  VALUES (v_po.company_id, p_po_id, v_num, v_uid, p_received_date, p_supplier_receipt_no, p_note)
  RETURNING id INTO v_receipt_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_po_line := (v_line->>'po_line_id')::uuid;
    v_qty := coalesce((v_line->>'quantity_received')::numeric, 0);
    v_rej := coalesce((v_line->>'quantity_rejected')::numeric, 0);
    IF v_qty <= 0 AND v_rej <= 0 THEN CONTINUE; END IF;

    SELECT quantity INTO v_ordered FROM po_line_items WHERE id = v_po_line AND po_id = p_po_id;
    IF v_ordered IS NULL THEN RAISE EXCEPTION 'Invalid line'; END IF;
    -- over-delivery allowed: no upper bound on received

    INSERT INTO receipt_line_items (receipt_id, po_line_id, quantity_received, quantity_rejected)
    VALUES (v_receipt_id, v_po_line, v_qty, v_rej);
  END LOOP;

  v_recv_status := recompute_po_received_status(p_po_id);

  IF v_recv_status = 'full' THEN
    UPDATE purchase_orders SET status = 'closed', prev_status = v_po.status, updated_at = now() WHERE id = p_po_id;
  END IF;

  INSERT INTO po_activity_log (company_id, po_id, actor_id, action, note)
  VALUES (v_po.company_id, p_po_id, v_uid, 'received', v_num);

  RETURN v_receipt_id;
END; $$;
GRANT EXECUTE ON FUNCTION create_receipt(uuid, date, text, text, jsonb) TO authenticated;


-- ===== 20260615090000_drop_procurement.sql =====
-- ============================================================
-- 20260615090000_drop_procurement.sql   (QuotePro migration 009)
-- Requestio → QuotePro: drop all procurement-domain tables.
-- KEEP: companies, users, user_permissions, user_invitations
-- ============================================================

-- Obsolete procurement RPCs / functions (reference dropped tables)
DROP FUNCTION IF EXISTS get_dashboard_stats(uuid, timestamptz, uuid, uuid, uuid, uuid, int) CASCADE;
DROP FUNCTION IF EXISTS generate_po_number(uuid) CASCADE;
DROP FUNCTION IF EXISTS generate_request_number(uuid) CASCADE;
DROP FUNCTION IF EXISTS submit_request(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS create_po_from_request(uuid) CASCADE;
DROP FUNCTION IF EXISTS create_receipt(uuid, date, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS recompute_po_received_status(uuid) CASCADE;

-- Procurement tables — CASCADE drops dependent FKs, policies, triggers, indexes.
-- Explicitly listed by the spec:
DROP TABLE IF EXISTS po_attachments      CASCADE;
DROP TABLE IF EXISTS po_line_items       CASCADE;
DROP TABLE IF EXISTS purchase_orders     CASCADE;
DROP TABLE IF EXISTS items               CASCADE;
DROP TABLE IF EXISTS departments         CASCADE;
DROP TABLE IF EXISTS locations           CASCADE;
DROP TABLE IF EXISTS projects            CASCADE;
DROP TABLE IF EXISTS categories          CASCADE;
DROP TABLE IF EXISTS suppliers           CASCADE;

-- Additional procurement tables present in the clone (Phase 2/3 / receipts):
DROP TABLE IF EXISTS receipt_attachments CASCADE;
DROP TABLE IF EXISTS receipt_line_items  CASCADE;
DROP TABLE IF EXISTS receipts            CASCADE;
DROP TABLE IF EXISTS po_activity_log      CASCADE;
DROP TABLE IF EXISTS activity_log         CASCADE;
DROP TABLE IF EXISTS approvals            CASCADE;
DROP TABLE IF EXISTS request_attachments CASCADE;
DROP TABLE IF EXISTS request_line_items  CASCADE;
DROP TABLE IF EXISTS requests            CASCADE;


-- ===== 20260615091000_companies_overhead_customers.sql =====
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


-- ===== 20260615092000_machines_workstations.sql =====
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


-- ===== 20260615093000_quotes_items_calculations.sql =====
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


-- ===== 20260615094000_quote_attachments.sql =====
-- ============================================================
-- 20260615094000_quote_attachments.sql  (QuotePro migration 013)
-- CREATE quote_attachments (replaces po_attachments).
-- Reuses the existing 'quotations' storage bucket.
-- ============================================================

CREATE TABLE IF NOT EXISTS quote_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quote_id     uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  file_name    text NOT NULL,
  storage_path text NOT NULL,                 -- Supabase Storage path
  file_size    integer,                       -- bytes
  uploaded_by  uuid REFERENCES users(id),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_attachments_quote   ON quote_attachments(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_attachments_company ON quote_attachments(company_id);

ALTER TABLE quote_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage quote attachments"
ON quote_attachments FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));


-- ===== 20260615095000_quote_rpcs.sql =====
-- ============================================================
-- 20260615095000_quote_rpcs.sql  (QuotePro migration 014)
-- RPC: generate_quote_number(company_id) → QUO-YYYY-NNN
-- RPC: get_quote_dashboard_stats(company_id) → json
-- ============================================================

-- ─── generate_quote_number ──────────────────────────────────
-- Atomically increments companies.quote_counter and formats
-- QUO-<current year>-<counter padded to 3>. Same style as the
-- old generate_po_number RPC (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION generate_quote_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
BEGIN
  UPDATE companies
  SET quote_counter = quote_counter + 1
  WHERE id = p_company_id
  RETURNING quote_counter INTO v_number;

  RETURN 'QUO-' || to_char(now(), 'YYYY') || '-' || lpad(v_number::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_quote_number(uuid) TO authenticated;

-- ─── get_quote_dashboard_stats ──────────────────────────────
-- Pipeline value, win-rate (90d), active quotes, realized this
-- month, recent quotes, and lost-reason breakdown.
CREATE OR REPLACE FUNCTION get_quote_dashboard_stats(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_won  integer;
  v_lost integer;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status = 'won'  AND created_at >= now() - interval '90 days'),
    COUNT(*) FILTER (WHERE status = 'lost' AND created_at >= now() - interval '90 days')
  INTO v_won, v_lost
  FROM quotes WHERE company_id = p_company_id;

  RETURN json_build_object(

    -- Pipeline value: sum of annual_value for open quotes (draft, sent)
    'pipeline_value', (
      SELECT COALESCE(SUM(c.annual_value), 0)
      FROM calculations c
      JOIN quote_items qi ON qi.id = c.quote_item_id
      JOIN quotes q       ON q.id  = qi.quote_id
      WHERE q.company_id = p_company_id
        AND q.status IN ('draft','sent')
    ),

    -- Win rate over last 90 days
    'win_rate', CASE WHEN (v_won + v_lost) > 0
                     THEN round((v_won::numeric / (v_won + v_lost)) * 100, 1)
                     ELSE 0 END,
    'won_90d',  v_won,
    'lost_90d', v_lost,

    -- Active quotes (draft + sent)
    'active_quotes', (
      SELECT COUNT(*) FROM quotes
      WHERE company_id = p_company_id AND status IN ('draft','sent')
    ),

    -- Realized this month (won, sent this calendar month)
    'realized_this_month', (
      SELECT COALESCE(SUM(c.annual_value), 0)
      FROM calculations c
      JOIN quote_items qi ON qi.id = c.quote_item_id
      JOIN quotes q       ON q.id  = qi.quote_id
      WHERE q.company_id = p_company_id
        AND q.status = 'won'
        AND q.sent_at >= date_trunc('month', now())
    ),

    -- Lost reasons breakdown
    'lost_reasons', (
      SELECT COALESCE(json_agg(json_build_object('reason', reason, 'count', cnt) ORDER BY cnt DESC), '[]'::json)
      FROM (
        SELECT COALESCE(lost_reason, 'other') AS reason, COUNT(*) AS cnt
        FROM quotes
        WHERE company_id = p_company_id AND status = 'lost'
        GROUP BY COALESCE(lost_reason, 'other')
      ) t
    ),

    -- Recent quotes (last 10)
    'recent_quotes', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT q.id, q.quote_number, q.title, q.status, q.created_at,
               cust.name AS customer_name
        FROM quotes q
        LEFT JOIN customers cust ON cust.id = q.customer_id
        WHERE q.company_id = p_company_id
        ORDER BY q.created_at DESC
        LIMIT 10
      ) t
    )

  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_quote_dashboard_stats(uuid) TO authenticated;


-- ===== 20260615100000_machine_rate_detail.sql =====
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


-- ===== 20260615110000_machine_energy_media.sql =====
-- ============================================================
-- 20260615110000_machine_energy_media.sql  (QuotePro migration 016)
-- Flexible energy/media list per machine (electricity, gas, water,
-- compressed air, steam…): [{name, unit, price_per_unit, consumption_per_h}].
-- ============================================================

ALTER TABLE machines ADD COLUMN IF NOT EXISTS energy_media jsonb NOT NULL DEFAULT '[]'::jsonb;


-- ===== 20260615120000_machine_water_air.sql =====
-- ============================================================
-- 20260615120000_machine_water_air.sql  (QuotePro migration 017)
-- Fixed variable-cost fields for water and compressed air (€/year).
-- ============================================================

ALTER TABLE machines ADD COLUMN IF NOT EXISTS water_cost_per_year         numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS compressed_air_cost_per_year numeric(12,2) NOT NULL DEFAULT 0;


-- ===== 20260615130000_labor_rates.sql =====
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


-- ===== 20260615140000_machine_model.sql =====
-- ============================================================
-- 20260615140000_machine_model.sql  (QuotePro migration 019)
-- Machine model/type label next to the name.
-- ============================================================

ALTER TABLE machines ADD COLUMN IF NOT EXISTS model text;


-- ===== 20260615150000_machine_updated_by.sql =====
-- ============================================================
-- 20260615150000_machine_updated_by.sql  (QuotePro migration 020)
-- Track who last saved a machine.
-- ============================================================

ALTER TABLE machines ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id);


-- ===== 20260615160000_labor_updated_by.sql =====
-- ============================================================
-- 20260615160000_labor_updated_by.sql  (QuotePro migration 021)
-- Track who last saved a labour rate.
-- ============================================================

ALTER TABLE labor_rates ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id);


-- ===== 20260615170000_customers_fields.sql =====
-- ============================================================
-- 20260615170000_customers_fields.sql  (QuotePro migration 022)
-- Customer fields to match the supplier form: split address,
-- payment terms, delivery parity, active/inactive status.
-- ============================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_street      text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_city        text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_postal_code text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms       text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS parity              text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status              text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','inactive'));


-- ===== 20260615180000_permission_modules.sql =====
-- ============================================================
-- 20260615180000_permission_modules.sql  (QuotePro migration 023)
-- Replace procurement permission modules with QuotePro sections.
-- ============================================================

ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_module_check;
DELETE FROM user_permissions WHERE module NOT IN ('quotes','customers','machine_rates','labor_rates');
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_module_check
  CHECK (module IN ('quotes','customers','machine_rates','labor_rates'));


-- ===== 20260615190000_overhead_calc.sql =====
-- ============================================================
-- 20260615190000_overhead_calc.sql  (QuotePro migration 024)
-- Cost-center inputs that DERIVE the overhead_* percentages.
-- pct = cost-center pool / base (annual). Stored on companies.
-- ============================================================

-- Annual indirect costs per cost centre
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_cc_material      numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_cc_manufacturing numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_cc_sga           numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_cc_logistics     numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_cc_rd            numeric(14,2) NOT NULL DEFAULT 0;

-- Annual direct cost bases
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_base_material      numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_base_manufacturing numeric(14,2) NOT NULL DEFAULT 0;


-- ===== 20260615200000_quote_prefix.sql =====
-- ============================================================
-- 20260615200000_quote_prefix.sql  (QuotePro migration 025)
-- Configurable quote number prefix + RPC uses it.
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS quote_prefix text NOT NULL DEFAULT 'QUO';

CREATE OR REPLACE FUNCTION generate_quote_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
  v_prefix text;
BEGIN
  UPDATE companies
  SET quote_counter = quote_counter + 1
  WHERE id = p_company_id
  RETURNING quote_counter, quote_prefix INTO v_number, v_prefix;

  RETURN COALESCE(v_prefix, 'QUO') || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_number::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_quote_number(uuid) TO authenticated;


-- ===== 20260615210000_perm_overheads.sql =====
-- ============================================================
-- 20260615210000_perm_overheads.sql  (QuotePro migration 026)
-- Add 'overheads' to allowed permission modules.
-- ============================================================

ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_module_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_module_check
  CHECK (module IN ('quotes','customers','machine_rates','labor_rates','overheads'));


-- ===== 20260615220000_quote_number_format.sql =====
-- ============================================================
-- 20260615220000_quote_number_format.sql  (QuotePro migration 027)
-- Quote number: no dashes, 4-digit counter, default prefix 'Q'.
-- e.g. Q20260001
-- ============================================================

ALTER TABLE companies ALTER COLUMN quote_prefix SET DEFAULT 'Q';
UPDATE companies SET quote_prefix = 'Q' WHERE quote_prefix = 'QUO';

CREATE OR REPLACE FUNCTION generate_quote_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
  v_prefix text;
BEGIN
  UPDATE companies
  SET quote_counter = quote_counter + 1
  WHERE id = p_company_id
  RETURNING quote_counter, quote_prefix INTO v_number, v_prefix;

  RETURN COALESCE(v_prefix, 'Q') || to_char(now(), 'YYYY') || lpad(v_number::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_quote_number(uuid) TO authenticated;


-- ===== 20260615230000_materials.sql =====
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


-- ===== 20260615240000_quote_item_drawing.sql =====
-- ============================================================
-- 20260615240000_quote_item_drawing.sql  (QuotePro migration 029)
-- Per-piece drawing/image (Storage path in the 'quotations' bucket).
-- ============================================================

ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS drawing_path text;


-- ===== 20260615250000_perm_materials.sql =====
-- ============================================================
-- 20260615250000_perm_materials.sql  (QuotePro migration 030)
-- Add 'materials' to allowed permission modules.
-- ============================================================

ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_module_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_module_check
  CHECK (module IN ('quotes','customers','materials','machine_rates','labor_rates','overheads'));


-- ===== 20260617000000_quote_attachment_kind.sql =====
-- ============================================================
-- 20260617000000_quote_attachment_kind.sql  (QuotePro migration 031)
-- Attachment kind: cad / email / drawing / other.
-- ============================================================

ALTER TABLE quote_attachments ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'other'
  CHECK (kind IN ('cad', 'email', 'drawing', 'other'));


-- ===== 20260617010000_quote_contact_leadtime.sql =====
-- ============================================================
-- 20260617010000_quote_contact_leadtime.sql  (QuotePro migration 032)
-- Quote-level contact (prefilled from customer, editable) + free-text lead time.
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS contact_email  text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS contact_phone  text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS lead_time      text;


-- ===== 20260617020000_quote_payment_parity.sql =====
-- ============================================================
-- 20260617020000_quote_payment_parity.sql  (QuotePro migration 033)
-- Quote-level payment terms + parity (prefilled from customer, editable).
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS parity        text;


-- ===== 20260617030000_quotations_bucket_mime.sql =====
-- ============================================================
-- 20260617030000_quotations_bucket_mime.sql  (QuotePro migration 034)
-- Quote attachments accept CAD / email / any file type, not just PDF/images.
-- Lift the mime-type whitelist and raise the size limit to 50 MB.
-- ============================================================

UPDATE storage.buckets
SET allowed_mime_types = NULL,        -- allow any file type (CAD, .eml, .msg, ...)
    file_size_limit    = 52428800     -- 50 MB
WHERE id = 'quotations';


-- ===== 20260617040000_attachment_kind_bom.sql =====
-- ============================================================
-- 20260617040000_attachment_kind_bom.sql  (QuotePro migration 035)
-- Add 'bom' to allowed attachment kinds.
-- ============================================================

ALTER TABLE quote_attachments DROP CONSTRAINT IF EXISTS quote_attachments_kind_check;
ALTER TABLE quote_attachments ADD CONSTRAINT quote_attachments_kind_check
  CHECK (kind IN ('cad', 'email', 'drawing', 'bom', 'other'));


-- ===== 20260618000000_attachment_quote_item.sql =====
-- ============================================================
-- 20260618000000_attachment_quote_item.sql  (QuotePro migration 036)
-- Link attachments optionally to a quote item (piece). NULL = quote-level.
-- Piece-level uploads still belong to the quote, so they show in the shared box.
-- ============================================================

ALTER TABLE quote_attachments
  ADD COLUMN IF NOT EXISTS quote_item_id uuid REFERENCES quote_items(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_quote_attachments_item ON quote_attachments(quote_item_id);


-- ===== 20260618010000_calc_quantities.sql =====
-- ============================================================
-- 20260618010000_calc_quantities.sql  (QuotePro migration 037)
-- Support up to 3 quote quantities per calculation (price breaks).
-- quantities[0] stays the primary qty (mirrors quote_items.quantity);
-- the existing cost_per_piece/selling_price/annual_value reflect the primary.
-- ============================================================

ALTER TABLE calculations ADD COLUMN IF NOT EXISTS quantities jsonb NOT NULL DEFAULT '[]'::jsonb;


-- ===== 20260618020000_calc_scrap.sql =====
-- ============================================================
-- 20260618020000_calc_scrap.sql  (QuotePro migration 038)
-- Production scrap/reject % applied to the whole piece cost.
-- ============================================================

ALTER TABLE calculations ADD COLUMN IF NOT EXISTS scrap_pct numeric NOT NULL DEFAULT 0;


-- ===== 20260618030000_calc_batch_size.sql =====
-- ============================================================
-- 20260618030000_calc_batch_size.sql  (QuotePro migration 039)
-- Optional batch/lot size. Setups repeat per batch: setups = ceil(qty / batch).
-- 0 = single setup for the whole order (legacy behaviour).
-- ============================================================

ALTER TABLE calculations ADD COLUMN IF NOT EXISTS batch_size numeric NOT NULL DEFAULT 0;


-- ===== 20260619000000_quote_item_thumb.sql =====
-- ============================================================
-- 20260619000000_quote_item_thumb.sql  (QuotePro migration 040)
-- Persisted thumbnail for a quote item (first CAD render or drawing),
-- so the quotes list can show part previews without re-rendering.
-- ============================================================

ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS thumb_path text;


-- ===== 20260619010000_offer_lifecycle.sql =====
-- ============================================================
-- 20260619010000_offer_lifecycle.sql  (QuotePro migration 041)
-- Offer lifecycle: issued snapshot + status set + pdf path.
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS snapshot   jsonb;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS issued_at  timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS pdf_path   text;

-- Allow the new lifecycle statuses (keep legacy won/lost/frozen for old data).
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('draft','issued','sent','accepted','rejected','expired','won','lost','frozen'));


-- ===== 20260622000000_dashboard_kpi.sql =====
-- ============================================================
-- 20260622000000_dashboard_kpi.sql
-- Dashboard KPI RPC functions for Quotes
-- - get_quote_trends: monthly trends for last N months
-- - get_customer_stats: top 10 customers by total value
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Function 1: get_quote_trends
-- Returns monthly quote trends (count, value, won count/value)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_quote_trends(
  p_company_id uuid,
  p_months integer DEFAULT 12
)
RETURNS TABLE (
  month text,
  quote_count integer,
  quote_value numeric,
  won_count integer,
  won_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(m, 'YYYY-MM')::text AS month,
    COALESCE(t.quote_count, 0)::integer,
    COALESCE(t.quote_value, 0)::numeric,
    COALESCE(t.won_count, 0)::integer,
    COALESCE(t.won_value, 0)::numeric
  FROM generate_series(
    date_trunc('month', NOW()) - ((p_months - 1) || ' months')::interval,
    date_trunc('month', NOW()),
    '1 month'::interval
  ) m
  LEFT JOIN (
    SELECT
      date_trunc('month', q.created_at)::date AS month_bucket,
      COUNT(DISTINCT q.id) AS quote_count,
      COALESCE(SUM(c.annual_value), 0) AS quote_value,
      COUNT(DISTINCT CASE WHEN q.status = 'won' THEN q.id END) AS won_count,
      COALESCE(SUM(CASE WHEN q.status = 'won' THEN c.annual_value ELSE 0 END), 0) AS won_value
    FROM quotes q
    LEFT JOIN quote_items qi ON qi.quote_id = q.id
    LEFT JOIN calculations c ON c.quote_item_id = qi.id
    WHERE q.company_id = p_company_id
      AND q.created_at >= date_trunc('month', NOW()) - ((p_months - 1) || ' months')::interval
    GROUP BY date_trunc('month', q.created_at)
  ) t ON t.month_bucket = m
  ORDER BY m;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- Function 2: get_customer_stats
-- Returns top 10 customers by total quote value with win rates
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_customer_stats(
  p_company_id uuid
)
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  total_value numeric,
  quote_count integer,
  won_count integer,
  win_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cust.id,
    cust.name,
    COALESCE(SUM(calc.annual_value), 0)::numeric AS total_value,
    COUNT(DISTINCT q.id)::integer AS quote_count,
    COUNT(DISTINCT CASE WHEN q.status = 'won' THEN q.id END)::integer AS won_count,
    CASE
      WHEN COUNT(DISTINCT q.id) > 0 THEN
        ROUND((COUNT(DISTINCT CASE WHEN q.status = 'won' THEN q.id END)::numeric / COUNT(DISTINCT q.id)::numeric * 100), 2)
      ELSE 0
    END::numeric AS win_rate
  FROM customers cust
  LEFT JOIN quotes q ON q.customer_id = cust.id
  LEFT JOIN quote_items qi ON qi.quote_id = q.id
  LEFT JOIN calculations calc ON calc.quote_item_id = qi.id
  WHERE cust.company_id = p_company_id
  GROUP BY cust.id, cust.name
  ORDER BY COALESCE(SUM(calc.annual_value), 0) DESC
  LIMIT 10;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- GRANT permissions to authenticated users
-- ────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION get_quote_trends(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_stats(uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- Create indexes to optimize the queries
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quotes_company_created ON quotes(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_quotes_company_status ON quotes(company_id, status);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_calculations_quote_item ON calculations(quote_item_id);


