-- ============================================================
-- 20261118000003_quote_closed_at.sql
-- The day a quote was won or lost (for the reports: how much business was won in a month).
-- Set automatically whenever the status becomes won / lost (editor, board, list …), cleared when it is
-- reopened. Existing closed quotes get their last change date. Re-runnable.
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS closed_at timestamptz;

UPDATE quotes SET closed_at = updated_at
WHERE status IN ('won', 'lost') AND closed_at IS NULL;

CREATE OR REPLACE FUNCTION set_quote_closed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('won', 'lost') THEN
    -- a new decision (or a change between won and lost) gets today's date
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR NEW.closed_at IS NULL THEN
      NEW.closed_at := COALESCE(CASE WHEN TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN OLD.closed_at END, now());
    END IF;
  ELSE
    NEW.closed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_closed_at ON quotes;
CREATE TRIGGER trg_quote_closed_at
  BEFORE INSERT OR UPDATE OF status ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_quote_closed_at();
