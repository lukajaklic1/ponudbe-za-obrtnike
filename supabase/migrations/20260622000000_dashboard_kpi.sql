-- ============================================================
-- 20260622000000_dashboard_kpi.sql
-- Dashboard KPI RPC functions for Quotes
-- - get_quote_trends: monthly trends for last N months
-- - get_customer_stats: top 10 customers by total value
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Function 1: get_quote_trends
-- Returns monthly quote trends (count, value, won count/value)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_quote_trends(
  p_company_id uuid,
  p_months integer DEFAULT 12
)
RETURNS TABLE (
  month text,
  quote_count integer,
  quote_value numeric,
  won_count integer,
  won_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(m, 'YYYY-MM')::text AS month,
    COALESCE(t.quote_count, 0)::integer,
    COALESCE(t.quote_value, 0)::numeric,
    COALESCE(t.won_count, 0)::integer,
    COALESCE(t.won_value, 0)::numeric
  FROM generate_series(
    date_trunc('month', NOW()) - ((p_months - 1) || ' months')::interval,
    date_trunc('month', NOW()),
    '1 month'::interval
  ) m
  LEFT JOIN (
    SELECT
      date_trunc('month', q.created_at)::date AS month_bucket,
      COUNT(DISTINCT q.id) AS quote_count,
      COALESCE(SUM(c.annual_value), 0) AS quote_value,
      COUNT(DISTINCT CASE WHEN q.status = 'won' THEN q.id END) AS won_count,
      COALESCE(SUM(CASE WHEN q.status = 'won' THEN c.annual_value ELSE 0 END), 0) AS won_value
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
-- Function 2: get_customer_stats
-- Returns top 10 customers by total quote value with win rates
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_customer_stats(
  p_company_id uuid
)
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  total_value numeric,
  quote_count integer,
  won_count integer,
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
    COALESCE(SUM(calc.annual_value), 0)::numeric AS total_value,
    COUNT(DISTINCT q.id)::integer AS quote_count,
    COUNT(DISTINCT CASE WHEN q.status = 'won' THEN q.id END)::integer AS won_count,
    CASE
      WHEN COUNT(DISTINCT q.id) > 0 THEN
        ROUND((COUNT(DISTINCT CASE WHEN q.status = 'won' THEN q.id END)::numeric / COUNT(DISTINCT q.id)::numeric * 100), 2)
      ELSE 0
    END::numeric AS win_rate
  FROM customers cust
  LEFT JOIN quotes q ON q.customer_id = cust.id
  LEFT JOIN quote_items qi ON qi.quote_id = q.id
  LEFT JOIN calculations calc ON calc.quote_item_id = qi.id
  WHERE cust.company_id = p_company_id
  GROUP BY cust.id, cust.name
  ORDER BY COALESCE(SUM(calc.annual_value), 0) DESC
  LIMIT 10;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- GRANT permissions to authenticated users
-- ────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION get_quote_trends(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_stats(uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- Create indexes to optimize the queries
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quotes_company_created ON quotes(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_quotes_company_status ON quotes(company_id, status);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_calculations_quote_item ON calculations(quote_item_id);
