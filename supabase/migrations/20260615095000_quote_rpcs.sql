-- ============================================================
-- 20260615095000_quote_rpcs.sql  (QuotePro migration 014)
-- RPC: generate_quote_number(company_id) → QUO-YYYY-NNN
-- RPC: get_quote_dashboard_stats(company_id) → json
-- ============================================================

-- ─── generate_quote_number ──────────────────────────────────
-- Atomically increments companies.quote_counter and formats
-- QUO-<current year>-<counter padded to 3>. Same style as the
-- old generate_po_number RPC (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION generate_quote_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
BEGIN
  UPDATE companies
  SET quote_counter = quote_counter + 1
  WHERE id = p_company_id
  RETURNING quote_counter INTO v_number;

  RETURN 'QUO-' || to_char(now(), 'YYYY') || '-' || lpad(v_number::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_quote_number(uuid) TO authenticated;

-- ─── get_quote_dashboard_stats ──────────────────────────────
-- Pipeline value, win-rate (90d), active quotes, realized this
-- month, recent quotes, and lost-reason breakdown.
CREATE OR REPLACE FUNCTION get_quote_dashboard_stats(p_company_id uuid)
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
  FROM quotes WHERE company_id = p_company_id;

  RETURN json_build_object(

    -- Pipeline value: sum of annual_value for open quotes (draft, sent)
    'pipeline_value', (
      SELECT COALESCE(SUM(c.annual_value), 0)
      FROM calculations c
      JOIN quote_items qi ON qi.id = c.quote_item_id
      JOIN quotes q       ON q.id  = qi.quote_id
      WHERE q.company_id = p_company_id
        AND q.status IN ('draft','sent')
    ),

    -- Win rate over last 90 days
    'win_rate', CASE WHEN (v_won + v_lost) > 0
                     THEN round((v_won::numeric / (v_won + v_lost)) * 100, 1)
                     ELSE 0 END,
    'won_90d',  v_won,
    'lost_90d', v_lost,

    -- Active quotes (draft + sent)
    'active_quotes', (
      SELECT COUNT(*) FROM quotes
      WHERE company_id = p_company_id AND status IN ('draft','sent')
    ),

    -- Realized this month (won, sent this calendar month)
    'realized_this_month', (
      SELECT COALESCE(SUM(c.annual_value), 0)
      FROM calculations c
      JOIN quote_items qi ON qi.id = c.quote_item_id
      JOIN quotes q       ON q.id  = qi.quote_id
      WHERE q.company_id = p_company_id
        AND q.status = 'won'
        AND q.sent_at >= date_trunc('month', now())
    ),

    -- Lost reasons breakdown
    'lost_reasons', (
      SELECT COALESCE(json_agg(json_build_object('reason', reason, 'count', cnt) ORDER BY cnt DESC), '[]'::json)
      FROM (
        SELECT COALESCE(lost_reason, 'other') AS reason, COUNT(*) AS cnt
        FROM quotes
        WHERE company_id = p_company_id AND status = 'lost'
        GROUP BY COALESCE(lost_reason, 'other')
      ) t
    ),

    -- Recent quotes (last 10)
    'recent_quotes', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT q.id, q.quote_number, q.title, q.status, q.created_at,
               cust.name AS customer_name
        FROM quotes q
        LEFT JOIN customers cust ON cust.id = q.customer_id
        WHERE q.company_id = p_company_id
        ORDER BY q.created_at DESC
        LIMIT 10
      ) t
    )

  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_quote_dashboard_stats(uuid) TO authenticated;
