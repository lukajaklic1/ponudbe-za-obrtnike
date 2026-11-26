-- A customer who fills in the configurator is matched by e-mail AND name (person) or by VAT number / e-mail + company name (company).
-- The same e-mail with another name is a new customer, so the offer is addressed to the person who filled in the form.
-- Re-runnable. Paste into the SQL editor of the Fenestio project (not `supabase db push`).
DO $patch$
DECLARE
  def text := pg_get_functiondef('submit_configuration(text,jsonb,jsonb,text,jsonb)'::regprocedure);
  old_lookup text := 'SELECT id INTO v_customer FROM customers WHERE company_id = c.id AND lower(email) = v_email ORDER BY created_at LIMIT 1;';
  new_lookup text := E'SELECT id INTO v_customer FROM customers\n'
    || E'  WHERE company_id = c.id\n'
    || E'    AND ( (lower(email) = v_email AND lower(trim(name)) = lower(trim(CASE WHEN v_ctype = ''company'' THEN v_cname_in ELSE v_person END)))\n'
    || E'       OR (v_ctype = ''company'' AND NULLIF(v_vatno, '''') IS NOT NULL\n'
    || E'           AND regexp_replace(upper(COALESCE(vat_number, '''')), ''[^A-Z0-9]'', '''', ''g'') = regexp_replace(upper(v_vatno), ''[^A-Z0-9]'', '''', ''g')) )\n'
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
