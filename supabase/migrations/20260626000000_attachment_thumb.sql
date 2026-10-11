-- ============================================================
-- 20260626000000_attachment_thumb.sql
-- Persisted thumbnail for an attachment (first CAD/PDF render),
-- stored under thumbs/ in the private quotations bucket so the
-- offer review/edit, inline kos view and offers list show previews
-- instantly without ever re-rendering CAD (WASM) or PDF.
-- ============================================================

ALTER TABLE quote_attachments ADD COLUMN IF NOT EXISTS thumb_path text;
