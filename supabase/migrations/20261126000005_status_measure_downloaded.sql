-- Statuses: "Izmera" (measure) is new, and "Preneseno" (downloaded) is back: the customer took the offer in the configurator himself,
-- as opposed to "Poslano" (sent), which the supplier sent. 8 statuses in all.
-- Quotes that the earlier merge turned from downloaded into sent are restored: a configurator quote that is sent but was never
-- sent by the supplier (no sent_at) is a downloaded one.
-- Re-runnable. Paste into the SQL editor of the Fenestio project (not `supabase db push`).
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('enquiry','measure','draft','issued','sent','downloaded','won','lost'));

UPDATE quotes SET status = 'downloaded' WHERE status = 'sent' AND source = 'configurator' AND sent_at IS NULL;

-- the configurator creates "downloaded" for an offer the customer takes straight away (if an earlier patch made it "sent", this undoes it)
DO $patch$
DECLARE
  def text := pg_get_functiondef('submit_configuration(text,jsonb,jsonb,text,jsonb)'::regprocedure);
BEGIN
  IF position('THEN ''sent'' ELSE ''enquiry''' IN def) > 0 THEN
    EXECUTE replace(def, 'THEN ''sent'' ELSE ''enquiry''', 'THEN ''downloaded'' ELSE ''enquiry''');
  END IF;
END
$patch$;
