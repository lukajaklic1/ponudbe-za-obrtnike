-- ============================================================
-- 20261112000002_drop_unused_tables.sql
-- Remove tables the app no longer uses (IRREVERSIBLE — all rows are lost):
--  * Toolingdesk leftovers: quote_items, calculations, machines, materials, labor_rates
--  * Finance (removed from the app): invoices, invoice_lines, purchase_invoices
--  * Izvedba (removed from the app): jobs — plus the quote_won_creates_job trigger on quotes
--    (dropped together with its function sync_job_from_quote)
-- Also drops every public function whose body still reads one of these tables
-- (old overloads, generate_invoice_number, mark_job_invoiced, sync_job_from_quote …).
-- Kept: quote_attachments (its old quote_item_id
-- foreign key is removed by CASCADE, the column stays).
-- ============================================================

-- 1) Functions that reference the dropped tables (exact signatures, overloads included)
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosrc ~* '\m(quote_items|calculations|machines|materials|labor_rates|invoices|invoice_lines|purchase_invoices|jobs)\M'
  LOOP
    -- Safety: never drop a function the app still calls — abort everything instead
    IF split_part(f.sig::text, '(', 1) IN (
      'accept_invitation','generate_quote_number','get_configurator','get_customer_stats','get_platform_stats',
      'get_quote_dashboard_stats','get_quote_trends','handle_onboarding','is_super_admin','set_user_active',
      'set_user_admin','submit_configuration','has_perm','is_my_admin','get_my_company_id'
    ) AND f.sig::text NOT IN ('get_quote_dashboard_stats(uuid)') THEN
      RAISE EXCEPTION 'Aborted: % is still used by the app but reads a table being dropped', f.sig;
    END IF;
    RAISE NOTICE 'drop function %', f.sig;
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', f.sig);
  END LOOP;
END $$;

-- 2) Tables (CASCADE removes their triggers, policies and foreign keys pointing at them)
DROP TABLE IF EXISTS invoice_lines     CASCADE;
DROP TABLE IF EXISTS invoices          CASCADE;
DROP TABLE IF EXISTS purchase_invoices CASCADE;
DROP TABLE IF EXISTS calculations      CASCADE;
DROP TABLE IF EXISTS quote_items       CASCADE;
DROP TABLE IF EXISTS labor_rates       CASCADE;
DROP TABLE IF EXISTS machines          CASCADE;
DROP TABLE IF EXISTS materials         CASCADE;
DROP TABLE IF EXISTS jobs              CASCADE;

NOTIFY pgrst, 'reload schema';
