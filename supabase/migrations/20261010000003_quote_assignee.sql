-- ============================================================
-- 20261010000003_quote_assignee.sql
-- quotes.assignee_id ("Odgovorna oseba") was used by the app and the
-- dashboard RPCs but never created by a migration.
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_assignee ON quotes(assignee_id);

-- Existing quotes: the person who created them is responsible
UPDATE quotes SET assignee_id = created_by WHERE assignee_id IS NULL;

NOTIFY pgrst, 'reload schema';
