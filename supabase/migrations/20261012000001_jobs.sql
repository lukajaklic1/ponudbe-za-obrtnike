-- ============================================================
-- 20261012000001_jobs.sql
-- Realizacija: every won quote becomes a job (Planirano → V izvajanju →
-- Končano → Zaračunano) with dates and an assignee. The calendar reads the
-- same table.
-- ============================================================

CREATE TABLE IF NOT EXISTS jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quote_id     uuid NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE CASCADE,
  customer_id  uuid REFERENCES customers(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'done', 'invoiced')),
  start_date   date,
  end_date     date,
  assignee_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  notes        text,
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_dates ON jobs(company_id, start_date, end_date);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_select" ON jobs;
CREATE POLICY "jobs_select" ON jobs FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
DROP POLICY IF EXISTS "jobs_insert" ON jobs;
CREATE POLICY "jobs_insert" ON jobs FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() AND has_perm('quotes', 'create'));
DROP POLICY IF EXISTS "jobs_update" ON jobs;
CREATE POLICY "jobs_update" ON jobs FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() AND has_perm('quotes', 'create'))
  WITH CHECK (company_id = get_my_company_id());
DROP POLICY IF EXISTS "jobs_delete" ON jobs;
CREATE POLICY "jobs_delete" ON jobs FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() AND is_my_admin());

-- Won quote → job (once). Reverting a won quote removes the job only while it
-- is still untouched (planned, no dates).
CREATE OR REPLACE FUNCTION sync_job_from_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'won' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'won') THEN
    INSERT INTO jobs (company_id, quote_id, customer_id, assignee_id)
    VALUES (NEW.company_id, NEW.id, NEW.customer_id, NEW.assignee_id)
    ON CONFLICT (quote_id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'won' AND NEW.status <> 'won' THEN
    DELETE FROM jobs
    WHERE quote_id = NEW.id AND status = 'planned' AND start_date IS NULL AND end_date IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quote_won_creates_job ON quotes;
CREATE TRIGGER quote_won_creates_job
  AFTER INSERT OR UPDATE OF status ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION sync_job_from_quote();

-- Existing won quotes
INSERT INTO jobs (company_id, quote_id, customer_id, assignee_id)
SELECT company_id, id, customer_id, assignee_id FROM quotes WHERE status = 'won'
ON CONFLICT (quote_id) DO NOTHING;
