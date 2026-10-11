-- ============================================================
-- 20260617020000_quote_payment_parity.sql  (QuotePro migration 033)
-- Quote-level payment terms + parity (prefilled from customer, editable).
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS parity        text;
