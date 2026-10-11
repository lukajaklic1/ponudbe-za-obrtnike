-- get_quote_trends: daily granularity when p_months = 1, monthly otherwise

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
  IF get_my_company_id() != p_company_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_months < 1 OR p_months > 36 THEN
    RAISE EXCEPTION 'p_months must be between 1 and 36';
  END IF;

  -- 30-day view: group by day
  IF p_months = 1 THEN
    RETURN QUERY
    SELECT
      to_char(d, 'YYYY-MM-DD')::text AS period,
      COALESCE(t.sent_count,     0)::integer,
      COALESCE(t.sent_value,     0)::numeric,
      COALESCE(t.realized_count, 0)::integer,
      COALESCE(t.realized_value, 0)::numeric
    FROM generate_series(
      (NOW() - '29 days'::interval)::date,
      NOW()::date,
      '1 day'::interval
    ) d
    LEFT JOIN (
      SELECT
        q.created_at::date AS day_bucket,
        COUNT(DISTINCT CASE WHEN q.status IN ('sent','won','lost') THEN q.id END)::integer AS sent_count,
        COALESCE(SUM(CASE WHEN q.status IN ('sent','won','lost') THEN c.annual_value ELSE 0 END), 0) AS sent_value,
        COUNT(DISTINCT CASE WHEN q.status = 'won' THEN q.id END)::integer AS realized_count,
        COALESCE(SUM(CASE WHEN q.status = 'won' THEN c.annual_value ELSE 0 END), 0) AS realized_value
      FROM quotes q
      LEFT JOIN quote_items qi ON qi.quote_id = q.id
      LEFT JOIN calculations c ON c.quote_item_id = qi.id
      WHERE q.company_id = p_company_id
        AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
        AND q.created_at >= NOW() - '29 days'::interval
      GROUP BY q.created_at::date
    ) t ON t.day_bucket = d
    ORDER BY d;

  -- 3/6/12-month view: group by month
  ELSE
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
        COUNT(DISTINCT CASE WHEN q.status IN ('sent','won','lost') THEN q.id END)::integer AS sent_count,
        COALESCE(SUM(CASE WHEN q.status IN ('sent','won','lost') THEN c.annual_value ELSE 0 END), 0) AS sent_value,
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
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quote_trends(uuid, integer, uuid) TO authenticated;
