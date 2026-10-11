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
