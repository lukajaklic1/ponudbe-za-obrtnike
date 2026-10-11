-- ============================================================
-- 20261010000001_obrtdesk_trades.sql
-- Obrtdesk: quoting for tradespeople (painters / facade first).
--  * price_items  — company price list (cenik): unit + price + VAT
--  * quote_lines  — quote positions (room/area, qty × unit price)
--  * quotes       — site address, discount, cached totals
--  * dashboard RPCs now read quotes.total_net (no calculations)
-- ============================================================

-- ─── Price list ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code         text,
  name         text NOT NULL,
  description  text,
  category     text,                            -- painting / prep / plaster / facade / material / other
  unit         text NOT NULL DEFAULT 'm2',      -- m2 / m / pcs / h / lump / l / kg
  price        numeric(12,2) NOT NULL DEFAULT 0,  -- net price per unit
  vat_rate     numeric(5,2)  NOT NULL DEFAULT 22,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_items_company ON price_items(company_id);
ALTER TABLE price_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_items_select" ON price_items FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
CREATE POLICY "price_items_insert" ON price_items FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() AND has_perm('price_list', 'create'));
CREATE POLICY "price_items_update" ON price_items FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() AND has_perm('price_list', 'create'))
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "price_items_delete" ON price_items FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() AND is_my_admin());

-- ─── Quote header additions ─────────────────────────────────
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS site_address text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_pct numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total_net    numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total_vat    numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total_gross  numeric(14,2) NOT NULL DEFAULT 0;

-- ─── Quote lines ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id       uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  position       integer NOT NULL DEFAULT 1,
  room           text,                            -- group / room label, e.g. "Dnevna soba"
  price_item_id  uuid REFERENCES price_items(id) ON DELETE SET NULL,
  name           text NOT NULL,
  description    text,
  unit           text NOT NULL DEFAULT 'm2',
  quantity       numeric(12,2) NOT NULL DEFAULT 0,
  unit_price     numeric(12,2) NOT NULL DEFAULT 0,
  discount_pct   numeric(5,2)  NOT NULL DEFAULT 0,
  vat_rate       numeric(5,2)  NOT NULL DEFAULT 22,
  total_net      numeric(14,2) NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quote_lines_quote ON quote_lines(quote_id);
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_lines_select" ON quote_lines FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
CREATE POLICY "quote_lines_insert" ON quote_lines FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() AND has_perm('quotes', 'create'));
CREATE POLICY "quote_lines_update" ON quote_lines FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() AND has_perm('quotes', 'create'))
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "quote_lines_delete" ON quote_lines FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() AND has_perm('quotes', 'create'));

-- ─── Permission modules ─────────────────────────────────────
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_module_check;
DELETE FROM user_permissions WHERE module NOT IN ('quotes','customers','price_list');
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_module_check
  CHECK (module IN ('quotes','customers','price_list'));

-- Trades default quote prefix "P" (Ponudba) for new companies
ALTER TABLE companies ALTER COLUMN quote_prefix SET DEFAULT 'P';

-- ─── Dashboard RPCs on quotes.total_net ─────────────────────
CREATE OR REPLACE FUNCTION get_quote_trends(
  p_company_id  uuid,
  p_months      integer DEFAULT 12,
  p_customer_id uuid    DEFAULT NULL,
  p_assignee_id uuid    DEFAULT NULL
)
RETURNS TABLE (period text, sent_count integer, sent_value numeric, realized_count integer, realized_value numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF get_my_company_id() IS DISTINCT FROM p_company_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT
    to_char(m, 'YYYY-MM')::text,
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
      COUNT(*) FILTER (WHERE q.status IN ('sent','won','lost'))::integer AS sent_count,
      COALESCE(SUM(q.total_net) FILTER (WHERE q.status IN ('sent','won','lost')), 0) AS sent_value,
      COUNT(*) FILTER (WHERE q.status = 'won')::integer AS realized_count,
      COALESCE(SUM(q.total_net) FILTER (WHERE q.status = 'won'), 0) AS realized_value
    FROM quotes q
    WHERE q.company_id = p_company_id
      AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
      AND (p_assignee_id IS NULL OR q.assignee_id = p_assignee_id)
      AND q.created_at >= date_trunc('month', NOW()) - ((p_months - 1) || ' months')::interval
    GROUP BY 1
  ) t ON t.month_bucket = m
  ORDER BY m;
END;
$$;

CREATE OR REPLACE FUNCTION get_customer_stats(
  p_company_id  uuid,
  p_assignee_id uuid DEFAULT NULL,
  p_status      text DEFAULT NULL
)
RETURNS TABLE (customer_id uuid, customer_name text, sent_value numeric, realized_value numeric, sent_count integer, realized_count integer, win_rate numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF get_my_company_id() IS DISTINCT FROM p_company_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT
    cust.id,
    cust.name,
    COALESCE(SUM(q.total_net) FILTER (WHERE q.status IN ('sent','won','lost')), 0)::numeric,
    COALESCE(SUM(q.total_net) FILTER (WHERE q.status = 'won'), 0)::numeric,
    COUNT(q.id) FILTER (WHERE q.status IN ('sent','won','lost'))::integer,
    COUNT(q.id) FILTER (WHERE q.status = 'won')::integer,
    CASE WHEN COUNT(q.id) FILTER (WHERE q.status IN ('sent','won','lost')) > 0
      THEN ROUND(COUNT(q.id) FILTER (WHERE q.status = 'won')::numeric
                 / COUNT(q.id) FILTER (WHERE q.status IN ('sent','won','lost'))::numeric * 100, 1)
      ELSE 0 END::numeric
  FROM customers cust
  LEFT JOIN quotes q ON q.customer_id = cust.id
    AND q.company_id = p_company_id
    AND (p_assignee_id IS NULL OR q.assignee_id = p_assignee_id)
    AND (p_status IS NULL OR q.status = p_status)
  WHERE cust.company_id = p_company_id
  GROUP BY cust.id, cust.name
  ORDER BY 3 DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_quote_dashboard_stats(
  p_company_id  uuid,
  p_customer_id uuid DEFAULT NULL,
  p_assignee_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_won  integer;
  v_lost integer;
BEGIN
  IF get_my_company_id() IS DISTINCT FROM p_company_id THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT
    COUNT(*) FILTER (WHERE status = 'won'  AND created_at >= now() - interval '90 days'),
    COUNT(*) FILTER (WHERE status = 'lost' AND created_at >= now() - interval '90 days')
  INTO v_won, v_lost
  FROM quotes
  WHERE company_id = p_company_id
    AND (p_customer_id IS NULL OR customer_id = p_customer_id)
    AND (p_assignee_id IS NULL OR assignee_id = p_assignee_id);

  RETURN json_build_object(
    'pipeline_value', (
      SELECT COALESCE(SUM(total_net), 0) FROM quotes
      WHERE company_id = p_company_id AND status IN ('sent','won','lost')
        AND (p_customer_id IS NULL OR customer_id = p_customer_id)
        AND (p_assignee_id IS NULL OR assignee_id = p_assignee_id)
    ),
    'win_rate', CASE WHEN (v_won + v_lost) > 0 THEN round((v_won::numeric / (v_won + v_lost)) * 100, 1) ELSE 0 END,
    'won_90d',  v_won,
    'lost_90d', v_lost,
    'active_quotes', (
      SELECT COUNT(*) FROM quotes
      WHERE company_id = p_company_id AND status IN ('sent','won','lost')
        AND (p_customer_id IS NULL OR customer_id = p_customer_id)
        AND (p_assignee_id IS NULL OR assignee_id = p_assignee_id)
    ),
    'realized_this_month', (
      SELECT COALESCE(SUM(total_net), 0) FROM quotes
      WHERE company_id = p_company_id AND status = 'won'
        AND date_trunc('month', created_at) = date_trunc('month', NOW())
        AND (p_customer_id IS NULL OR customer_id = p_customer_id)
        AND (p_assignee_id IS NULL OR assignee_id = p_assignee_id)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_quote_trends(uuid, integer, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_stats(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_quote_dashboard_stats(uuid, uuid, uuid) TO authenticated;

-- ─── Onboarding without the registration webhook ────────────
-- (previous version read vault.secrets.value, which doesn't exist → signup failed)
CREATE OR REPLACE FUNCTION public.handle_onboarding(
  p_company_name text,
  p_first_name   text,
  p_last_name    text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_company_id uuid;
  v_user_email text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT company_id INTO v_company_id FROM users WHERE id = v_user_id FOR UPDATE;
  IF FOUND THEN
    RETURN json_build_object('company_id', v_company_id, 'user_id', v_user_id);
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.companies (name, currency, po_prefix, po_next_number, quote_prefix)
  VALUES (p_company_name, 'EUR', 'PO', 1, 'P')
  RETURNING id INTO v_company_id;

  INSERT INTO public.users (id, company_id, first_name, last_name, email, is_admin)
  VALUES (v_user_id, v_company_id, p_first_name, p_last_name, v_user_email, true);

  RETURN json_build_object('company_id', v_company_id, 'user_id', v_user_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.handle_onboarding TO authenticated;

-- Images for the quote attachments bucket (site photos)
UPDATE storage.buckets
SET allowed_mime_types = NULL, file_size_limit = 20971520
WHERE id = 'quotations';
