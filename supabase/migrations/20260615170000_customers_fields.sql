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
