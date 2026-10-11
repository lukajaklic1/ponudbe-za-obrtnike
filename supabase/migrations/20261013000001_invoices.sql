-- ============================================================
-- 20261013000001_invoices.sql
-- Računi: issued invoices (incl. advance invoices) linked to quotes and
-- jobs, and received invoices (bills) with an uploaded file.
-- ============================================================

-- ─── Company settings ───────────────────────────────────────
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_prefix   text    NOT NULL DEFAULT 'R';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_counter  integer NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_year     integer;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_due_days integer NOT NULL DEFAULT 8;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS vat_payer        boolean NOT NULL DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_note     text;

-- ─── Issued invoices ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number  text,                                   -- set when issued
  kind            text NOT NULL DEFAULT 'invoice' CHECK (kind IN ('invoice', 'advance')),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'sent', 'paid', 'cancelled')),
  customer_id     uuid REFERENCES customers(id) ON DELETE SET NULL,
  quote_id        uuid REFERENCES quotes(id) ON DELETE SET NULL,
  job_id          uuid REFERENCES jobs(id) ON DELETE SET NULL,
  title           text,
  issue_date      date NOT NULL DEFAULT CURRENT_DATE,
  service_date    date,                                   -- datum opravljene storitve (od)
  service_date_to date,                                   -- … do (obdobje)
  due_date        date,
  reference       text,                                   -- sklic, e.g. SI00 2026-0001
  notes           text,
  discount_pct    numeric(5,2)  NOT NULL DEFAULT 0,
  total_net       numeric(14,2) NOT NULL DEFAULT 0,
  total_vat       numeric(14,2) NOT NULL DEFAULT 0,
  total_gross     numeric(14,2) NOT NULL DEFAULT 0,
  paid_at         date,
  sent_at         timestamptz,
  issued_at       timestamptz,
  snapshot        jsonb,                                  -- frozen copy for the PDF
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (company_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quote ON invoices(quote_id);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  position            integer NOT NULL DEFAULT 1,
  price_item_id       uuid REFERENCES price_items(id) ON DELETE SET NULL,
  advance_invoice_id  uuid REFERENCES invoices(id) ON DELETE SET NULL,   -- deduction of an advance invoice
  name                text NOT NULL,
  description         text,
  unit                text NOT NULL DEFAULT 'pcs',
  quantity            numeric(12,2) NOT NULL DEFAULT 1,
  unit_price          numeric(12,2) NOT NULL DEFAULT 0,
  discount_pct        numeric(5,2)  NOT NULL DEFAULT 0,
  vat_rate            numeric(5,2)  NOT NULL DEFAULT 22,
  total_net           numeric(14,2) NOT NULL DEFAULT 0,
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() AND has_perm('quotes', 'create'));
DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() AND has_perm('quotes', 'create'))
  WITH CHECK (company_id = get_my_company_id());
-- Issued invoices are never deleted (they are cancelled instead); drafts only, admins only
DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_delete" ON invoices FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() AND status = 'draft' AND is_my_admin());

DROP POLICY IF EXISTS "invoice_lines_select" ON invoice_lines;
CREATE POLICY "invoice_lines_select" ON invoice_lines FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
DROP POLICY IF EXISTS "invoice_lines_insert" ON invoice_lines;
CREATE POLICY "invoice_lines_insert" ON invoice_lines FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() AND has_perm('quotes', 'create'));
DROP POLICY IF EXISTS "invoice_lines_update" ON invoice_lines;
CREATE POLICY "invoice_lines_update" ON invoice_lines FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() AND has_perm('quotes', 'create'))
  WITH CHECK (company_id = get_my_company_id());
DROP POLICY IF EXISTS "invoice_lines_delete" ON invoice_lines;
CREATE POLICY "invoice_lines_delete" ON invoice_lines FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() AND has_perm('quotes', 'create'));

-- Invoice number R-2026-0001: counter restarts every year (invoices must be
-- numbered sequentially within the year)
CREATE OR REPLACE FUNCTION generate_invoice_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
  v_prefix text;
  v_year   integer := extract(year FROM now())::int;
BEGIN
  IF get_my_company_id() != p_company_id OR NOT has_perm('quotes', 'create') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE companies
  SET invoice_counter = CASE WHEN invoice_year = v_year THEN invoice_counter + 1 ELSE 1 END,
      invoice_year = v_year
  WHERE id = p_company_id
  RETURNING invoice_counter, invoice_prefix INTO v_number, v_prefix;

  RETURN COALESCE(NULLIF(v_prefix, ''), 'R') || '-' || v_year || '-' || lpad(v_number::text, 4, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION generate_invoice_number(uuid) TO authenticated;

-- An issued (final) invoice for a job moves the job to "Zaračunano"
CREATE OR REPLACE FUNCTION mark_job_invoiced()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_id IS NOT NULL AND NEW.kind = 'invoice'
     AND NEW.status IN ('issued', 'sent', 'paid')
     AND (TG_OP = 'INSERT' OR OLD.status = 'draft') THEN
    UPDATE jobs
    SET status = 'invoiced', finished_at = COALESCE(finished_at, now()), updated_at = now()
    WHERE id = NEW.job_id AND status IN ('planned', 'in_progress', 'done');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_issued_marks_job ON invoices;
CREATE TRIGGER invoice_issued_marks_job
  AFTER INSERT OR UPDATE OF status ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION mark_job_invoiced();

-- ─── Received invoices (bills) ──────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_name   text NOT NULL,
  supplier_vat    text,
  invoice_number  text,
  category        text NOT NULL DEFAULT 'material' CHECK (category IN ('material', 'tools', 'subcontract', 'fuel', 'rent', 'other')),
  issue_date      date,
  due_date        date,
  total_net       numeric(14,2),
  total_vat       numeric(14,2),
  total_gross     numeric(14,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  paid_at         date,
  job_id          uuid REFERENCES jobs(id) ON DELETE SET NULL,   -- cost of this job
  file_path       text,                                          -- quotations bucket: <company>/bills/…
  file_name       text,
  notes           text,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_company ON purchase_invoices(company_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_job ON purchase_invoices(job_id);

ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_invoices_select" ON purchase_invoices;
CREATE POLICY "purchase_invoices_select" ON purchase_invoices FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
DROP POLICY IF EXISTS "purchase_invoices_insert" ON purchase_invoices;
CREATE POLICY "purchase_invoices_insert" ON purchase_invoices FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() AND has_perm('quotes', 'create'));
DROP POLICY IF EXISTS "purchase_invoices_update" ON purchase_invoices;
CREATE POLICY "purchase_invoices_update" ON purchase_invoices FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() AND has_perm('quotes', 'create'))
  WITH CHECK (company_id = get_my_company_id());
DROP POLICY IF EXISTS "purchase_invoices_delete" ON purchase_invoices;
CREATE POLICY "purchase_invoices_delete" ON purchase_invoices FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() AND is_my_admin());

-- refresh the API so it sees the new tables
NOTIFY pgrst, 'reload schema';
