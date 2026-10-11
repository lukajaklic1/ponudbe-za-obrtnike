-- ============================================================
-- 20260617000000_quote_attachment_kind.sql  (QuotePro migration 031)
-- Attachment kind: cad / email / drawing / other.
-- ============================================================

ALTER TABLE quote_attachments ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'other'
  CHECK (kind IN ('cad', 'email', 'drawing', 'other'));
