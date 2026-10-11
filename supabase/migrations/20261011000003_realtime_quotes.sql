-- ============================================================
-- 20261011000003_realtime_quotes.sql
-- Live dashboard: broadcast changes on quotes via Supabase Realtime.
-- (RLS still applies — users only receive their own company's rows.)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quotes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
  END IF;
END $$;
