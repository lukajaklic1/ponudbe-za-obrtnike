-- ============================================================
-- 20260617040000_attachment_kind_bom.sql  (QuotePro migration 035)
-- Add 'bom' to allowed attachment kinds.
-- ============================================================

ALTER TABLE quote_attachments DROP CONSTRAINT IF EXISTS quote_attachments_kind_check;
ALTER TABLE quote_attachments ADD CONSTRAINT quote_attachments_kind_check
  CHECK (kind IN ('cad', 'email', 'drawing', 'bom', 'other'));
