-- ============================================================
-- 20260615094000_quote_attachments.sql  (QuotePro migration 013)
-- CREATE quote_attachments (replaces po_attachments).
-- Reuses the existing 'quotations' storage bucket.
-- ============================================================

CREATE TABLE IF NOT EXISTS quote_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quote_id     uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  file_name    text NOT NULL,
  storage_path text NOT NULL,                 -- Supabase Storage path
  file_size    integer,                       -- bytes
  uploaded_by  uuid REFERENCES users(id),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_attachments_quote   ON quote_attachments(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_attachments_company ON quote_attachments(company_id);

ALTER TABLE quote_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage quote attachments"
ON quote_attachments FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));
