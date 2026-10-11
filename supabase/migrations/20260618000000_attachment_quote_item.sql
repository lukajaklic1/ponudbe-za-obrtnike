-- ============================================================
-- 20260618000000_attachment_quote_item.sql  (QuotePro migration 036)
-- Link attachments optionally to a quote item (piece). NULL = quote-level.
-- Piece-level uploads still belong to the quote, so they show in the shared box.
-- ============================================================

ALTER TABLE quote_attachments
  ADD COLUMN IF NOT EXISTS quote_item_id uuid REFERENCES quote_items(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_quote_attachments_item ON quote_attachments(quote_item_id);
