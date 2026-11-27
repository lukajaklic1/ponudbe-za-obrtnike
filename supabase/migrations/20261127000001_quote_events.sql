-- ============================================================
-- 20261127000001_quote_events.sql
-- History of a quote: who did what to it, and when.
-- Status changes are written by a trigger, so the history has no holes
-- even when the status is changed by the public configurator RPC or by SQL.
-- The app adds what the database cannot see: saved edits, issuing, sending,
-- the customer opening the offer, attachments, a change of assignee.
-- ============================================================

CREATE TABLE IF NOT EXISTS quote_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quote_id    uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  -- created | edited | issued | sent | status | viewed | downloaded
  -- | assignee | attachment_added | attachment_removed
  action      text NOT NULL,
  from_status text,
  to_status   text,
  meta        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_events_quote ON quote_events(quote_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_events_company ON quote_events(company_id, created_at DESC);

ALTER TABLE quote_events ENABLE ROW LEVEL SECURITY;

-- Members of the company read and write their own company's history.
DROP POLICY IF EXISTS "Company members read quote events" ON quote_events;
CREATE POLICY "Company members read quote events"
ON quote_events FOR SELECT
TO authenticated
USING (company_id = (SELECT get_my_company_id()));

DROP POLICY IF EXISTS "Company members write quote events" ON quote_events;
CREATE POLICY "Company members write quote events"
ON quote_events FOR INSERT
TO authenticated
WITH CHECK (company_id = (SELECT get_my_company_id()));

-- The history is a record: nobody edits or deletes a line of it.
REVOKE UPDATE, DELETE ON quote_events FROM authenticated;

-- ── the trigger: a quote is born, and every status change after that ──
CREATE OR REPLACE FUNCTION log_quote_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO quote_events (company_id, quote_id, actor_id, action, to_status, meta)
    VALUES (NEW.company_id, NEW.id, v_actor, 'created', NEW.status,
            jsonb_build_object('source', COALESCE(NEW.source, 'app'), 'total_net', NEW.total_net));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO quote_events (company_id, quote_id, actor_id, action, from_status, to_status, meta)
    VALUES (NEW.company_id, NEW.id, v_actor, 'status', OLD.status, NEW.status,
            jsonb_build_object('total_net', NEW.total_net));
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_quote_events_ins ON quotes;
CREATE TRIGGER trg_quote_events_ins
AFTER INSERT ON quotes
FOR EACH ROW EXECUTE FUNCTION log_quote_event();

DROP TRIGGER IF EXISTS trg_quote_events_upd ON quotes;
CREATE TRIGGER trg_quote_events_upd
AFTER UPDATE OF status ON quotes
FOR EACH ROW EXECUTE FUNCTION log_quote_event();

-- ── the history of the quotes that already exist ──
-- One line per quote so the timeline does not start empty: when it was made,
-- and, where the timestamps say so, when it was issued, sent and closed.
INSERT INTO quote_events (company_id, quote_id, actor_id, action, to_status, meta, created_at)
SELECT q.company_id, q.id, q.created_by, 'created', 'draft',
       jsonb_build_object('source', COALESCE(q.source, 'app'), 'backfilled', true), q.created_at
FROM quotes q
WHERE NOT EXISTS (SELECT 1 FROM quote_events e WHERE e.quote_id = q.id AND e.action = 'created');

INSERT INTO quote_events (company_id, quote_id, actor_id, action, to_status, meta, created_at)
SELECT q.company_id, q.id, q.created_by, 'status', 'issued',
       jsonb_build_object('backfilled', true), q.issued_at
FROM quotes q
WHERE q.issued_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM quote_events e WHERE e.quote_id = q.id AND e.to_status = 'issued');

INSERT INTO quote_events (company_id, quote_id, actor_id, action, to_status, meta, created_at)
SELECT q.company_id, q.id, q.created_by, 'status', 'sent',
       jsonb_build_object('backfilled', true), q.sent_at
FROM quotes q
WHERE q.sent_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM quote_events e WHERE e.quote_id = q.id AND e.to_status = 'sent');

INSERT INTO quote_events (company_id, quote_id, actor_id, action, to_status, meta, created_at)
SELECT q.company_id, q.id, q.created_by, 'status', q.status,
       jsonb_build_object('backfilled', true), COALESCE(q.closed_at, q.updated_at)
FROM quotes q
WHERE q.status IN ('won', 'lost')
  AND NOT EXISTS (SELECT 1 FROM quote_events e WHERE e.quote_id = q.id AND e.to_status = q.status);
