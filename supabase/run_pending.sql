-- 000004_configurator_customer_match
DO $patch$
DECLARE
  def text := pg_get_functiondef('submit_configuration(text,jsonb,jsonb,text,jsonb)'::regprocedure);
  old_lookup text := 'SELECT id INTO v_customer FROM customers WHERE company_id = c.id AND lower(email) = v_email ORDER BY created_at LIMIT 1;';
  new_lookup text := E'SELECT id INTO v_customer FROM customers\n'
    || E'  WHERE company_id = c.id\n'
    || E'    AND ( (lower(email) = v_email AND lower(trim(name)) = lower(trim(CASE WHEN v_ctype = ''company'' THEN v_cname_in ELSE v_person END)))\n'
    || E'       OR (v_ctype = ''company'' AND NULLIF(v_vatno, '''') IS NOT NULL\n'
    || E'           AND regexp_replace(upper(COALESCE(vat_number, '''')), ''[^A-Z0-9]'', '''', ''g'') = regexp_replace(upper(v_vatno), ''[^A-Z0-9]'', '''', ''g'')) )\n'
    || E'  ORDER BY created_at LIMIT 1;';
BEGIN
  IF position('lower(trim(name)) = lower(trim(CASE WHEN v_ctype' IN def) > 0 THEN
    RAISE NOTICE 'already patched';
  ELSIF position(old_lookup IN def) = 0 THEN
    RAISE EXCEPTION 'customer lookup not found in submit_configuration';
  ELSE
    EXECUTE replace(def, old_lookup, new_lookup);
  END IF;
END
$patch$;

-- 000005_status_measure_downloaded
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('enquiry','measure','draft','issued','sent','downloaded','won','lost'));
UPDATE quotes SET status = 'downloaded' WHERE status = 'sent' AND source = 'configurator' AND sent_at IS NULL;
DO $patch$
DECLARE
  def text := pg_get_functiondef('submit_configuration(text,jsonb,jsonb,text,jsonb)'::regprocedure);
BEGIN
  IF position('THEN ''sent'' ELSE ''enquiry''' IN def) > 0 THEN
    EXECUTE replace(def, 'THEN ''sent'' ELSE ''enquiry''', 'THEN ''downloaded'' ELSE ''enquiry''');
  END IF;
END
$patch$;

-- 000006_reverse_charge
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS reverse_charge boolean NOT NULL DEFAULT false;

