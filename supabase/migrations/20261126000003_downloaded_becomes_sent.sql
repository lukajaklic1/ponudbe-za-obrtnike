-- "Ponudba prenesena" (downloaded) is the same as "Poslano": the offer is with the customer.
-- Where a quote came from stays in quotes.source ('configurator' or manual), so it is filtered by source, not by status.
-- Re-runnable. Paste into the SQL editor of the Fenestio project (not `supabase db push`).
UPDATE quotes SET status = 'sent' WHERE status = 'downloaded';

ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('enquiry','draft','issued','sent','won','lost'));

-- what the configurator creates when the customer takes the offer right away
DO $patch$
DECLARE
  def text := pg_get_functiondef('submit_configuration(text,jsonb,jsonb,text,jsonb)'::regprocedure);
BEGIN
  IF position('THEN ''downloaded''' IN def) > 0 THEN
    EXECUTE replace(def, 'THEN ''downloaded''', 'THEN ''sent''');
  END IF;
END
$patch$;
