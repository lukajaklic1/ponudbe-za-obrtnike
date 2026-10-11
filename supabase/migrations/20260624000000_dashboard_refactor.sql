-- ============================================================
-- 20260624000000_dashboard_refactor.sql
-- Dashboard refactor - Updated RPC functions for new requirements
-- - get_quote_trends: returns sent and realized metrics
-- - get_customer_stats: returns top 10 with full metrics
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Function 1: get_quote_trends (UPDATED)
-- Returns period trends with sent and realized values
-- ────────────────────────────────────────────────────────────
-- obrtdesk-fix: return types changed vs. 20260622000000 → drop every overload first
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('get_quote_trends', 'get_customer_stats') LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION get_quote_trends(
  p_company_id uuid,
  p_months integer DEFAULT 12
)
RETURNS TABLE (
  period text,
  sent_count integer,
  sent_value numeric,
  realized_count integer,
  realized_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(m, 'YYYY-MM')::text AS period,
    COALESCE(t.sent_count, 0)::integer,
    COALESCE(t.sent_value, 0)::numeric,
    COALESCE(t.realized_count, 0)::integer,
    COALESCE(t.realized_value, 0)::numeric
  FROM generate_series(
    date_trunc('month', NOW()) - ((p_months - 1) || ' months')::interval,
    date_trunc('month', NOW()),
    '1 month'::interval
  ) m
  LEFT JOIN (
    SELECT
      date_trunc('month', q.created_at)::date AS month_bucket,
      COUNT(DISTINCT CASE WHEN q.status IN ('sent', 'accepted', 'won') THEN q.id END) AS sent_count,
      COALESCE(SUM(CASE WHEN q.status IN ('sent', 'accepted', 'won') THEN c.annual_value ELSE 0 END), 0) AS sent_value,
      COUNT(DISTINCT CASE WHEN q.status IN ('won', 'accepted') THEN q.id END) AS realized_count,
      COALESCE(SUM(CASE WHEN q.status IN ('won', 'accepted') THEN c.annual_value ELSE 0 END), 0) AS realized_value
    FROM quotes q
    LEFT JOIN quote_items qi ON qi.quote_id = q.id
    LEFT JOIN calculations c ON c.quote_item_id = qi.id
    WHERE q.company_id = p_company_id
      AND q.created_at >= date_trunc('month', NOW()) - ((p_months - 1) || ' months')::interval
    GROUP BY date_trunc('month', q.created_at)
  ) t ON t.month_bucket = m
  ORDER BY m;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- Function 2: get_customer_stats (UPDATED)
-- Returns top 10 customers with sent and realized metrics
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_customer_stats(
  p_company_id uuid
)
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  sent_value numeric,
  realized_value numeric,
  sent_count integer,
  realized_count integer,
  win_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cust.id,
    cust.name,
    COALESCE(SUM(CASE WHEN q.status IN ('sent', 'accepted', 'won') THEN calc.annual_value ELSE 0 END), 0)::numeric AS sent_value,
    COALESCE(SUM(CASE WHEN q.status IN ('won', 'accepted') THEN calc.annual_value ELSE 0 END), 0)::numeric AS realized_value,
    COUNT(DISTINCT CASE WHEN q.status IN ('sent', 'accepted', 'won') THEN q.id END)::integer AS sent_count,
    COUNT(DISTINCT CASE WHEN q.status IN ('won', 'accepted') THEN q.id END)::integer AS realized_count,
    CASE
      WHEN COUNT(DISTINCT CASE WHEN q.status IN ('sent', 'accepted', 'won') THEN q.id END) > 0 THEN
        ROUND((COUNT(DISTINCT CASE WHEN q.status IN ('won', 'accepted') THEN q.id END)::numeric / COUNT(DISTINCT CASE WHEN q.status IN ('sent', 'accepted', 'won') THEN q.id END)::numeric * 100), 1)
      ELSE 0
    END::numeric AS win_rate
  FROM customers cust
  LEFT JOIN quotes q ON q.customer_id = cust.id
  LEFT JOIN quote_items qi ON qi.quote_id = q.id
  LEFT JOIN calculations calc ON calc.quote_item_id = qi.id
  WHERE cust.company_id = p_company_id
  GROUP BY cust.id, cust.name
  ORDER BY COALESCE(SUM(CASE WHEN q.status IN ('sent', 'accepted', 'won') THEN calc.annual_value ELSE 0 END), 0) DESC
  LIMIT 10;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- GRANT permissions to authenticated users
-- ────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION get_quote_trends(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_stats(uuid) TO authenticated;
