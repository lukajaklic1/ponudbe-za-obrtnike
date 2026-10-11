-- ============================================================
-- 20260615240000_quote_item_drawing.sql  (QuotePro migration 029)
-- Per-piece drawing/image (Storage path in the 'quotations' bucket).
-- ============================================================

ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS drawing_path text;
