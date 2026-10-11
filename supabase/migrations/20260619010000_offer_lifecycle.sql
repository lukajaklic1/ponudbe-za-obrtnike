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
