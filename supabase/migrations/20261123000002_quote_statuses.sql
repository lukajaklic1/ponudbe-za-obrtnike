-- ============================================================
-- 20261123000002_quote_statuses.sql
-- Two new quote statuses for what the customer does in the configurator:
--   enquiry     the customer sent an enquiry; the supplier still has to make and send the offer
--   downloaded  the customer took the offer straight away ("Ponudba prenesena"): the offer is with the customer
-- submit_configuration() sets the status: the page sends p_customer.outcome = 'offer' when the customer
-- downloaded the offer; the server only believes it when the supplier's configurator allows offers
-- (end mode pdf or choose). Everything else is an enquiry.
-- Old configurator enquiries (still "draft") become enquiries. Reports that count sent quotes count downloaded ones too.
-- Re-runnable. Run after 20261123000001. Do NOT use `supabase db push` from this folder: paste it into the SQL editor of the Fenestio project.
-- ============================================================

-- 1. the statuses
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('enquiry','draft','issued','sent','downloaded','accepted','rejected','expired','won','lost','frozen'));

-- 2. what the configurator creates
DO $patch$
DECLARE
  def text := pg_get_functiondef('submit_configuration(text,jsonb,jsonb,text,jsonb)'::regprocedure);
  anchor text := E'(SELECT name FROM customers WHERE id = v_customer), ''draft'', ''configurator'', v_owner, v_owner,';
BEGIN
  IF position('''downloaded''' IN def) = 0 THEN
    IF position(anchor IN def) = 0 THEN RAISE EXCEPTION 'anchor not found in submit_configuration'; END IF;
    def := replace(def, anchor,
      E'(SELECT name FROM customers WHERE id = v_customer),\n'
      || E'          CASE WHEN p_customer->>''outcome'' = ''offer'' AND COALESCE(c.configurator_end_mode, ''enquiry'') IN (''pdf'', ''choose'') THEN ''downloaded'' ELSE ''enquiry'' END,\n'
      || E'          ''configurator'', v_owner, v_owner,');
    EXECUTE def;
  END IF;
END
$patch$;

-- 3. enquiries that came in before this change
UPDATE quotes SET status = 'enquiry' WHERE source = 'configurator' AND status = 'draft';

-- 4. reports that count sent quotes: a downloaded offer is a sent offer
DO $patch$
DECLARE
  r record;
  def text;
  newdef text;
BEGIN
  FOR r IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname LIKE 'get\_%' AND p.prosrc ILIKE '%quotes%' AND p.prosrc LIKE '%''sent''%'
  LOOP
    def := pg_get_functiondef(r.oid);
    newdef := def;
    IF position('''downloaded''' IN def) = 0 THEN
      newdef := replace(newdef, '''sent'',''won'',''lost''', '''sent'',''downloaded'',''won'',''lost''');
      newdef := replace(newdef, '''sent'', ''won'', ''lost''', '''sent'', ''downloaded'', ''won'', ''lost''');
      newdef := replace(newdef, 'status = ''sent''', 'status IN (''sent'', ''downloaded'')');
      IF newdef <> def THEN
        EXECUTE newdef;
        RAISE NOTICE 'counts downloaded offers as sent: %', r.proname;
      END IF;
    END IF;
  END LOOP;
END
$patch$;
