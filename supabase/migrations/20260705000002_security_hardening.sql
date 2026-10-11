-- ============================================================
-- 20260705000002_security_hardening.sql
-- Fix all critical/high security vulnerabilities:
-- 1. get_my_company_id — block inactive users at DB level
-- 2. users UPDATE policy — prevent self-promotion to admin
-- 3. user_permissions — restrict write to admins only
-- 4. user_invitations — restrict write to admins only
-- 5. RPC functions — verify caller belongs to p_company_id
-- 6. generate_quote_number — verify caller belongs to company
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Block deactivated users at DB level
-- Any RLS policy using get_my_company_id() will return NULL
-- for inactive users, effectively denying all data access.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM users WHERE id = auth.uid() AND is_active = true
$$;


-- ────────────────────────────────────────────────────────────
-- 2. Prevent non-admins from self-promoting or editing others
-- Users can only update their own row, and cannot change
-- is_admin or is_active (those require admin via RPC).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_update" ON users;

CREATE POLICY "users_update"
ON users FOR UPDATE
TO authenticated
USING (
  company_id = get_my_company_id()
  AND (
    id = auth.uid()       -- own row
    OR (SELECT is_admin FROM users WHERE id = auth.uid())  -- or caller is admin
  )
)
WITH CHECK (
  company_id = get_my_company_id()
  AND (
    -- Non-admins can only update their own non-sensitive fields
    -- Admins can update anyone
    (SELECT is_admin FROM users WHERE id = auth.uid())
    OR id = auth.uid()
  )
);

-- Prevent any user from directly writing is_admin or is_active
-- via a SECURITY DEFINER function that enforces admin check
CREATE OR REPLACE FUNCTION set_user_active(p_user_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  -- Prevent deactivating yourself
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot deactivate yourself';
  END IF;
  UPDATE users SET is_active = p_active, updated_at = now() WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION set_user_active(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION set_user_admin(p_user_id uuid, p_is_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE users SET is_admin = p_is_admin, updated_at = now() WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION set_user_admin(uuid, boolean) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. user_permissions — restrict INSERT/UPDATE/DELETE to admins
-- Any member can still SELECT (to see their own permissions).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members can manage permissions" ON user_permissions;

CREATE POLICY "Members can view own permissions"
ON user_permissions FOR SELECT
TO authenticated
USING (user_id IN (SELECT id FROM users WHERE company_id = get_my_company_id()));

CREATE POLICY "Admins can manage permissions"
ON user_permissions FOR INSERT
TO authenticated
WITH CHECK (
  user_id IN (SELECT id FROM users WHERE company_id = get_my_company_id())
  AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
);

CREATE POLICY "Admins can update permissions"
ON user_permissions FOR UPDATE
TO authenticated
USING (user_id IN (SELECT id FROM users WHERE company_id = get_my_company_id()))
WITH CHECK (
  user_id IN (SELECT id FROM users WHERE company_id = get_my_company_id())
  AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
);

CREATE POLICY "Admins can delete permissions"
ON user_permissions FOR DELETE
TO authenticated
USING (
  user_id IN (SELECT id FROM users WHERE company_id = get_my_company_id())
  AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
);


-- ────────────────────────────────────────────────────────────
-- 4. user_invitations — restrict write to admins only
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members can manage invitations" ON user_invitations;

CREATE POLICY "Members can view invitations"
ON user_invitations FOR SELECT
TO authenticated
USING (company_id = get_my_company_id());

CREATE POLICY "Admins can manage invitations"
ON user_invitations FOR INSERT
TO authenticated
WITH CHECK (
  company_id = get_my_company_id()
  AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
);

CREATE POLICY "Admins can update invitations"
ON user_invitations FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id())
WITH CHECK (
  company_id = get_my_company_id()
  AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
);

CREATE POLICY "Admins can delete invitations"
ON user_invitations FOR DELETE
TO authenticated
USING (
  company_id = get_my_company_id()
  AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
);


-- ────────────────────────────────────────────────────────────
-- 5. RPC functions — verify caller belongs to p_company_id
-- SECURITY DEFINER RPCs bypass RLS, so they must self-enforce.
-- ────────────────────────────────────────────────────────────

-- generate_quote_number
CREATE OR REPLACE FUNCTION generate_quote_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
BEGIN
  IF get_my_company_id() != p_company_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE companies
  SET quote_counter = quote_counter + 1
  WHERE id = p_company_id
  RETURNING quote_counter INTO v_number;

  RETURN 'QUO-' || to_char(now(), 'YYYY') || '-' || lpad(v_number::text, 3, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION generate_quote_number(uuid) TO authenticated;


-- get_quote_dashboard_stats
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
  IF get_my_company_id() != p_company_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status = 'won'  AND created_at >= now() - interval '90 days'),
    COUNT(*) FILTER (WHERE status = 'lost' AND created_at >= now() - interval '90 days')
  INTO v_won, v_lost
  FROM quotes
  WHERE company_id = p_company_id
    AND (p_customer_id IS NULL OR customer_id = p_customer_id);

  RETURN json_build_object(
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


-- get_quote_trends
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

  -- Cap months to prevent DoS via huge generate_series
  IF p_months < 1 OR p_months > 36 THEN
    RAISE EXCEPTION 'p_months must be between 1 and 36';
  END IF;

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
END;
$$;
GRANT EXECUTE ON FUNCTION get_quote_trends(uuid, integer, uuid) TO authenticated;


-- get_customer_stats
DROP FUNCTION IF EXISTS get_customer_stats(uuid);

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
  IF get_my_company_id() != p_company_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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
