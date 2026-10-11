-- ============================================================
-- 20260619000000_quote_item_thumb.sql  (QuotePro migration 040)
-- Persisted thumbnail for a quote item (first CAD render or drawing),
-- so the quotes list can show part previews without re-rendering.
-- ============================================================

ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS thumb_path text;
