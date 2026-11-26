-- The configurator must create an offer taken straight away as 'sent' (the status 'downloaded' is gone from quotes_status_check).
-- If submit_configuration still writes 'downloaded', the customer gets "Posiljanje ni uspelo (quotes_status_check)". This replaces it.
-- Re-runnable. Paste into the SQL editor of the Fenestio project (not `supabase db push`).
DO $patch$
DECLARE
  def text := pg_get_functiondef('submit_configuration(text,jsonb,jsonb,text,jsonb)'::regprocedure);
BEGIN
  IF position('''downloaded''' IN def) > 0 THEN
    EXECUTE replace(def, '''downloaded''', '''sent''');
    RAISE NOTICE 'submit_configuration now creates sent instead of downloaded';
  ELSE
    RAISE NOTICE 'submit_configuration does not mention downloaded (nothing to patch)';
  END IF;
END
$patch$;
