-- ============================================================
-- 20261012000002_jobs_manual.sql
-- Jobs can also be added by hand (work that never had a quote):
-- quote_id becomes optional and the job keeps its own title / site / value
-- (also used to override what came from the quote when plans change).
-- ============================================================

ALTER TABLE jobs ALTER COLUMN quote_id DROP NOT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS title        text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS site_address text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS value        numeric(14,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by   uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_quote_or_title;
ALTER TABLE jobs ADD CONSTRAINT jobs_quote_or_title CHECK (quote_id IS NOT NULL OR title IS NOT NULL);

-- New status: Odpovedano (job called off)
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('planned', 'in_progress', 'done', 'invoiced', 'cancelled'));

-- Optional working hours (same every day of the job), e.g. 08:00–12:00,
-- so one person can have several jobs on the same day
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS end_time   time;
