-- ============================================================
-- 20261014000001_jobs_team.sql
-- Several workers per job, and "Zaračunano" driven only by invoices
-- (cancelling the invoice puts the job back to "Končano").
-- ============================================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assignee_ids uuid[] NOT NULL DEFAULT '{}';
UPDATE jobs SET assignee_ids = ARRAY[assignee_id]
WHERE assignee_id IS NOT NULL AND assignee_ids = '{}';

-- Won quote → job: the quote's assignee becomes the job's first worker
CREATE OR REPLACE FUNCTION sync_job_from_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'won' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'won') THEN
    INSERT INTO jobs (company_id, quote_id, customer_id, assignee_id, assignee_ids)
    VALUES (NEW.company_id, NEW.id, NEW.customer_id, NEW.assignee_id,
            CASE WHEN NEW.assignee_id IS NULL THEN '{}'::uuid[] ELSE ARRAY[NEW.assignee_id] END)
    ON CONFLICT (quote_id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'won' AND NEW.status <> 'won' THEN
    DELETE FROM jobs
    WHERE quote_id = NEW.id AND status = 'planned' AND start_date IS NULL AND end_date IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Issued final invoice → job "Zaračunano"; cancelled (and no other live final
-- invoice for the job) → back to "Končano"
CREATE OR REPLACE FUNCTION mark_job_invoiced()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_id IS NULL OR NEW.kind <> 'invoice' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('issued', 'sent', 'paid') AND (TG_OP = 'INSERT' OR OLD.status = 'draft') THEN
    UPDATE jobs
    SET status = 'invoiced', finished_at = COALESCE(finished_at, now()), updated_at = now()
    WHERE id = NEW.job_id AND status IN ('planned', 'in_progress', 'done');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM invoices
          WHERE job_id = NEW.job_id AND kind = 'invoice' AND id <> NEW.id AND status IN ('issued', 'sent', 'paid')
        ) THEN
    UPDATE jobs SET status = 'done', updated_at = now()
    WHERE id = NEW.job_id AND status = 'invoiced';
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
