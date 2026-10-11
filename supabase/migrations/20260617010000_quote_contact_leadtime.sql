-- ============================================================
-- 20260617010000_quote_contact_leadtime.sql  (QuotePro migration 032)
-- Quote-level contact (prefilled from customer, editable) + free-text lead time.
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS contact_email  text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS contact_phone  text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS lead_time      text;
