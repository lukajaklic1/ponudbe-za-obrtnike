-- Obrtdesk namestitev — KORAK 6 od 6
-- Samo za PRAZEN Supabase projekt. Prilepi celoto v SQL Editor in klikni Run.
-- vsebuje: 20261010000004_customer_person_company.sql … 20261011000004_delete_guards.sql

-- ===== 20261010000004_customer_person_company.sql =====
-- ============================================================
-- 20261010000004_customer_person_company.sql
-- Customers are mostly private persons (first + last name),
-- sometimes companies (name + VAT ID + contact person).
-- customers.name stays the display name used everywhere.
-- ============================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type text NOT NULL DEFAULT 'person';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_name text;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_customer_type_check;
ALTER TABLE customers ADD CONSTRAINT customers_customer_type_check CHECK (customer_type IN ('person', 'company'));

-- Existing rows: with a VAT ID → company, otherwise split the name into first/last
UPDATE customers SET customer_type = 'company' WHERE vat_number IS NOT NULL AND vat_number <> '';
UPDATE customers
SET first_name = split_part(name, ' ', 1),
    last_name  = NULLIF(substr(name, length(split_part(name, ' ', 1)) + 2), '')
WHERE customer_type = 'person' AND first_name IS NULL;

NOTIFY pgrst, 'reload schema';


-- ===== 20261011000001_quote_defaults.sql =====
-- ============================================================
-- 20261011000001_quote_defaults.sql
-- Company-level quote defaults:
--  * payment_terms_list   — the company's usual payment terms (JSON array of strings)
--  * default_payment_terms — preselected on a new quote
--  * default_valid_days    — "valid until" = today + N days
--  * default_parity        — Incoterms code preselected on a new quote (optional)
-- quotes.parity already exists.
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS payment_terms_list jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_payment_terms text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_valid_days integer NOT NULL DEFAULT 30;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_parity text;

NOTIFY pgrst, 'reload schema';


-- ===== 20261011000002_company_legal_details.sql =====
-- ============================================================
-- 20261011000002_company_legal_details.sql
-- Company details required on business documents (ZGD-1):
--  * s.p.:          firma, sedež, matična številka
--  * d.o.o. / d.d.: + registrski organ, osnovni kapital (+ nevplačani del)
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS legal_form text;               -- sp / doo / dd / other
ALTER TABLE companies ADD COLUMN IF NOT EXISTS registration_number text;      -- matična številka
ALTER TABLE companies ADD COLUMN IF NOT EXISTS registry_authority text;       -- registrski organ (npr. Okrožno sodišče v Ljubljani)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS share_capital numeric(14,2);   -- osnovni kapital
ALTER TABLE companies ADD COLUMN IF NOT EXISTS unpaid_capital numeric(14,2);  -- nevplačani osnovni kapital

NOTIFY pgrst, 'reload schema';


-- ===== 20261011000003_realtime_quotes.sql =====
-- ============================================================
-- 20261011000003_realtime_quotes.sql
-- Live dashboard: broadcast changes on quotes via Supabase Realtime.
-- (RLS still applies — users only receive their own company's rows.)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quotes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
  END IF;
END $$;


-- ===== 20261011000004_delete_guards.sql =====
-- ============================================================
-- 20261011000004_delete_guards.sql
-- Enforce the delete rules in the database too (not only in the UI):
--  * a service used on any quote cannot be deleted (deactivate instead)
--  * only draft quotes can be deleted
-- ============================================================

-- Services: block delete when referenced by a quote line
CREATE OR REPLACE FUNCTION prevent_used_price_item_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM quote_lines WHERE price_item_id = OLD.id) THEN
    RAISE EXCEPTION 'Te storitve ni mogoče izbrisati, ker je uporabljena v ponudbah. Storitev je možno deaktivirati.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS price_item_delete_guard ON price_items;
CREATE TRIGGER price_item_delete_guard
  BEFORE DELETE ON price_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_used_price_item_delete();

-- Quotes: admins may delete drafts only
DROP POLICY IF EXISTS "quotes_delete" ON quotes;
CREATE POLICY "quotes_delete" ON quotes FOR DELETE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND status = 'draft'
    AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
  );


