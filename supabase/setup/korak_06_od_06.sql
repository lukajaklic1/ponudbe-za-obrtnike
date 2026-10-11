-- Obrtdesk namestitev — KORAK 6 od 6
-- Samo za PRAZEN Supabase projekt. Prilepi celoto v SQL Editor in klikni Run.
-- vsebuje: 20261010000004_customer_person_company.sql … 20261011000001_quote_defaults.sql

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


