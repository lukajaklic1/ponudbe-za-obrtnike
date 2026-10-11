-- ============================================================
-- 20260705000000_fix_dashboard_status_filter.sql
-- Fix dashboard RPCs: only count quotes from 'sent' status onwards.
-- issued → NOT counted. sent/won/lost = sent metrics. won = realized.
-- Also adds p_customer_id filter to get_quote_trends.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- get_quote_trends (with optional customer filter)
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_quote_trends(uuid, integer, uuid);
DROP FUNCTION IF EXISTS get_quote_trends(uuid, integer);

CREATE OR REPLACE FUNCTION get_quote_trends(
  p_company_id  uuid,
  p_months      integer DEFAULT 12,
  p_customer_id uuid    DEFAULT NULL
)
RETURNS TABLE (
  period          text,
  sent_count      integer,
  sent_value      numeric,
  realized_count  integer,
  realized_value  numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(m, 'YYYY-MM')::text AS period,
    COALESCE(t.sent_count,     0)::integer,
    COALESCE(t.sent_value,     0)::numeric,
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
      -- sent = quotes that reached customers: sent, won, lost
      COUNT(DISTINCT CASE WHEN q.status IN ('sent','won','lost') THEN q.id END)::integer AS sent_count,
      COALESCE(SUM(CASE WHEN q.status IN ('sent','won','lost') THEN c.annual_value ELSE 0 END), 0) AS sent_value,
      -- realized = won quotes only
      COUNT(DISTINCT CASE WHEN q.status = 'won' THEN q.id END)::integer AS realized_count,
      COALESCE(SUM(CASE WHEN q.status = 'won' THEN c.annual_value ELSE 0 END), 0) AS realized_value
    FROM quotes q
    LEFT JOIN quote_items qi ON qi.quote_id = q.id
    LEFT JOIN calculations c ON c.quote_item_id = qi.id
    WHERE q.company_id = p_company_id
      AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
      AND q.created_at >= date_trunc('month', NOW()) - ((p_months - 1) || ' months')::interval
    GROUP BY date_trunc('month', q.created_at)
  ) t ON t.month_bucket = m
  ORDER BY m;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quote_trends(uuid, integer, uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- get_customer_stats
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_customer_stats(
  p_company_id uuid
)
RETURNS TABLE (
  customer_id    uuid,
  customer_name  text,
  sent_value     numeric,
  realized_value numeric,
  sent_count     integer,
  realized_count integer,
  win_rate       numeric
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
    COALESCE(SUM(CASE WHEN q.status IN ('sent','won','lost') THEN calc.annual_value ELSE 0 END), 0)::numeric AS sent_value,
    COALESCE(SUM(CASE WHEN q.status = 'won'                 THEN calc.annual_value ELSE 0 END), 0)::numeric AS realized_value,
    COUNT(DISTINCT CASE WHEN q.status IN ('sent','won','lost') THEN q.id END)::integer AS sent_count,
    COUNT(DISTINCT CASE WHEN q.status = 'won'                  THEN q.id END)::integer AS realized_count,
    CASE
      WHEN COUNT(DISTINCT CASE WHEN q.status IN ('sent','won','lost') THEN q.id END) > 0 THEN
        ROUND(
          COUNT(DISTINCT CASE WHEN q.status = 'won' THEN q.id END)::numeric
          / COUNT(DISTINCT CASE WHEN q.status IN ('sent','won','lost') THEN q.id END)::numeric
          * 100, 1
        )
      ELSE 0
    END::numeric AS win_rate
  FROM customers cust
  LEFT JOIN quotes q ON q.customer_id = cust.id AND q.company_id = p_company_id
  LEFT JOIN quote_items qi ON qi.quote_id = q.id
  LEFT JOIN calculations calc ON calc.quote_item_id = qi.id
  WHERE cust.company_id = p_company_id
  GROUP BY cust.id, cust.name
  ORDER BY COALESCE(SUM(CASE WHEN q.status IN ('sent','won','lost') THEN calc.annual_value ELSE 0 END), 0) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_customer_stats(uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- get_quote_dashboard_stats — fix pipeline_value (remove draft/issued)
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_quote_dashboard_stats(uuid, uuid);
DROP FUNCTION IF EXISTS get_quote_dashboard_stats(uuid);

CREATE OR REPLACE FUNCTION get_quote_dashboard_stats(
  p_company_id  uuid,
  p_customer_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_won  integer;
  v_lost integer;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status = 'won'  AND created_at >= now() - interval '90 days'),
    COUNT(*) FILTER (WHERE status = 'lost' AND created_at >= now() - interval '90 days')
  INTO v_won, v_lost
  FROM quotes
  WHERE company_id = p_company_id
    AND (p_customer_id IS NULL OR customer_id = p_customer_id);

  RETURN json_build_object(
    -- Pipeline: only quotes actually sent to customers
    'pipeline_value', (
      SELECT COALESCE(SUM(c.annual_value), 0)
      FROM calculations c
      JOIN quote_items qi ON qi.id = c.quote_item_id
      JOIN quotes q       ON q.id  = qi.quote_id
      WHERE q.company_id = p_company_id
        AND q.status IN ('sent','won','lost')
        AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
    ),
    'win_rate', CASE WHEN (v_won + v_lost) > 0
                     THEN round((v_won::numeric / (v_won + v_lost)) * 100, 1)
                     ELSE 0 END,
    'won_90d',  v_won,
    'lost_90d', v_lost,
    'active_quotes', (
      SELECT COUNT(*) FROM quotes
      WHERE company_id = p_company_id
        AND status IN ('sent','won','lost')
        AND (p_customer_id IS NULL OR customer_id = p_customer_id)
    ),
    'realized_this_month', (
      SELECT COALESCE(SUM(c.annual_value), 0)
      FROM calculations c
      JOIN quote_items qi ON qi.id = c.quote_item_id
      JOIN quotes q       ON q.id  = qi.quote_id
      WHERE q.company_id = p_company_id
        AND q.status = 'won'
        AND date_trunc('month', q.created_at) = date_trunc('month', NOW())
        AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_quote_dashboard_stats(uuid, uuid) TO authenticated;
