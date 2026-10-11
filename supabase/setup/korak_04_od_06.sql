-- Obrtdesk namestitev — KORAK 4 od 6
-- Samo za PRAZEN Supabase projekt. Prilepi celoto v SQL Editor in klikni Run.
-- vsebuje: 20260624000000_dashboard_refactor.sql … 20260705000007_security_fixes4.sql

-- ===== 20260624000000_dashboard_refactor.sql =====
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


-- ===== 20260626000000_attachment_thumb.sql =====
-- ============================================================
-- 20260626000000_attachment_thumb.sql
-- Persisted thumbnail for an attachment (first CAD/PDF render),
-- stored under thumbs/ in the private quotations bucket so the
-- offer review/edit, inline kos view and offers list show previews
-- instantly without ever re-rendering CAD (WASM) or PDF.
-- ============================================================

ALTER TABLE quote_attachments ADD COLUMN IF NOT EXISTS thumb_path text;


-- ===== 20260626010000_quotations_update_policy.sql =====
-- ============================================================
-- 20260626010000_quotations_update_policy.sql
-- Allow company members to UPDATE their own objects in the
-- quotations bucket, so thumbnail upserts (upsert: true) work
-- when a thumbnail is regenerated for the same path.
-- ============================================================

DROP POLICY IF EXISTS "Company members can update quotations" ON storage.objects;
CREATE POLICY "Company members can update quotations"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'quotations'
  AND (storage.foldername(name))[1] = (SELECT get_my_company_id()::text)
)
WITH CHECK (
  bucket_id = 'quotations'
  AND (storage.foldername(name))[1] = (SELECT get_my_company_id()::text)
);


-- ===== 20260627000000_company_terms.sql =====
ALTER TABLE companies ADD COLUMN IF NOT EXISTS quote_terms text;


-- ===== 20260627010000_company_terms_en.sql =====
ALTER TABLE companies ADD COLUMN IF NOT EXISTS quote_terms_en text;


-- ===== 20260705000000_fix_dashboard_status_filter.sql =====
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


-- ===== 20260705000001_user_is_active.sql =====
-- Add is_active to users table; default true for all existing users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;


-- ===== 20260705000002_security_hardening.sql =====
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


-- ===== 20260705000003_security_hardening2.sql =====
-- ============================================================
-- 20260705000003_security_hardening2.sql
-- Second-pass security fixes from audit round 2:
-- 1. set_user_admin/set_user_active — add cross-company guard
-- 2. users_update — block non-admins from writing is_admin/is_active
-- 3. companies_update/delete — restrict to admins only
-- 4. accept_invitation — block if caller already has a profile
-- 5. user_permissions SELECT — own row only (+ admin sees all)
-- 6. user_invitations UPDATE — add admin check to USING clause
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. set_user_admin — add cross-company ownership check
-- ────────────────────────────────────────────────────────────
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
  -- Ensure target user belongs to the caller's company
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = p_user_id AND company_id = get_my_company_id()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE users SET is_admin = p_is_admin, updated_at = now() WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION set_user_admin(uuid, boolean) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 2. set_user_active — add cross-company ownership check
-- ────────────────────────────────────────────────────────────
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
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot deactivate yourself';
  END IF;
  -- Ensure target user belongs to the caller's company
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = p_user_id AND company_id = get_my_company_id()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE users SET is_active = p_active, updated_at = now() WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION set_user_active(uuid, boolean) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. users_update — block non-admins from setting is_admin / is_active
-- Achieved by revoking column-level UPDATE from authenticated
-- and granting it back only via the SECURITY DEFINER RPCs above.
-- ────────────────────────────────────────────────────────────
REVOKE UPDATE (is_admin, is_active) ON users FROM authenticated;


-- ────────────────────────────────────────────────────────────
-- 4. companies_update — restrict to admins only
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "companies_update" ON companies;

CREATE POLICY "companies_update"
ON companies FOR UPDATE
TO authenticated
USING (id = get_my_company_id())
WITH CHECK (
  id = get_my_company_id()
  AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
);


-- ────────────────────────────────────────────────────────────
-- 5. companies_delete — restrict to admins only
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "companies_delete" ON companies;

CREATE POLICY "companies_delete"
ON companies FOR DELETE
TO authenticated
USING (
  id = get_my_company_id()
  AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
);


-- ────────────────────────────────────────────────────────────
-- 6. accept_invitation — block if caller already has a profile
-- Prevents company-hopping by an existing user accepting a
-- new company's invitation and overwriting their profile.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_invitation()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid;
  v_email text;
  v_inv   user_invitations%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Block if the user already belongs to a company
  IF EXISTS (SELECT 1 FROM users WHERE id = v_uid) THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT * INTO v_inv
  FROM user_invitations
  WHERE lower(email) = lower(v_email) AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'No pending invitation for this email';
  END IF;

  INSERT INTO public.users (id, company_id, first_name, last_name, email, is_admin, department_id, job_title)
  VALUES (v_uid, v_inv.company_id, coalesce(v_inv.first_name, ''), coalesce(v_inv.last_name, ''), v_email, v_inv.is_admin, v_inv.department_id, v_inv.job_title)
  ON CONFLICT (id) DO NOTHING;

  IF v_inv.permissions IS NOT NULL THEN
    INSERT INTO public.user_permissions (user_id, module, can_view, can_create, can_approve, can_pay)
    SELECT v_uid,
           p->>'module',
           coalesce((p->>'can_view')::boolean, false),
           coalesce((p->>'can_create')::boolean, false),
           coalesce((p->>'can_approve')::boolean, false),
           coalesce((p->>'can_pay')::boolean, false)
    FROM jsonb_array_elements(v_inv.permissions) AS p
    ON CONFLICT (user_id, module) DO UPDATE
      SET can_view   = EXCLUDED.can_view,
          can_create = EXCLUDED.can_create,
          can_approve = EXCLUDED.can_approve,
          can_pay    = EXCLUDED.can_pay;
  END IF;

  UPDATE user_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  RETURN json_build_object('company_id', v_inv.company_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation() TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 7. user_permissions SELECT — own row only for non-admins;
--    admins can see all permissions in their company.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view own permissions" ON user_permissions;

CREATE POLICY "Members can view own permissions"
ON user_permissions FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
);


-- ────────────────────────────────────────────────────────────
-- 8. user_invitations UPDATE — admin check in USING (not just WITH CHECK)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can update invitations" ON user_invitations;

CREATE POLICY "Admins can update invitations"
ON user_invitations FOR UPDATE
TO authenticated
USING (
  company_id = get_my_company_id()
  AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
)
WITH CHECK (
  company_id = get_my_company_id()
  AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
);


-- ===== 20260705000004_trends_daily_for_30d.sql =====
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


-- ===== 20260705000005_fix_quote_number_format.sql =====
-- Fix generate_quote_number to use quote_prefix from company settings
-- instead of hardcoded 'QUO-' prefix. Format: {prefix}{YYYY}{0000}

CREATE OR REPLACE FUNCTION generate_quote_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
  v_prefix text;
BEGIN
  IF get_my_company_id() != p_company_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE companies
  SET quote_counter = quote_counter + 1
  WHERE id = p_company_id
  RETURNING quote_counter, quote_prefix INTO v_number, v_prefix;

  RETURN COALESCE(v_prefix, 'Q') || to_char(now(), 'YYYY') || lpad(v_number::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_quote_number(uuid) TO authenticated;


-- ===== 20260705000006_security_fixes3.sql =====
-- Security fixes round 3
-- 1. generate_po_number: add company ownership check (was missing)
-- 2. users INSERT: restrict to onboarding/invitation path only

-- 1. Fix generate_po_number — add the same guard as generate_quote_number
CREATE OR REPLACE FUNCTION generate_po_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_next   integer;
BEGIN
  -- Verify caller belongs to this company
  IF get_my_company_id() != p_company_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE companies
  SET po_next_number = po_next_number + 1
  WHERE id = p_company_id
  RETURNING po_prefix, po_next_number INTO v_prefix, v_next;

  RETURN COALESCE(v_prefix, 'PO') || '-' || lpad(v_next::text, 5, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_po_number(uuid) TO authenticated;

-- 2. Restrict users INSERT to onboarding + invitation paths only
-- Direct INSERT from client is blocked; handle_onboarding and accept_invitation
-- are both SECURITY DEFINER and create the users row server-side.
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users: insert own profile" ON users;

CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND (
      -- Allow if coming through onboarding (no existing users row yet, no company yet)
      NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
      OR
      -- Allow if there is a pending invitation for this user's email
      EXISTS (
        SELECT 1 FROM user_invitations ui
        JOIN auth.users au ON lower(au.email) = lower(ui.email)
        WHERE au.id = auth.uid()
          AND ui.status = 'pending'
          AND ui.company_id = users.company_id
      )
    )
  );


-- ===== 20260705000007_security_fixes4.sql =====
-- Security fixes round 4
-- 1. Quote status transition enforcement via trigger
-- 2. Prevent quote_counter from being decreased

-- ─── 1. Quote status transition trigger ──────────────────────────────────────
-- Final statuses (won/lost/accepted/rejected) require is_admin OR can_approve.
-- Other transitions (draft→issued→sent→expired) only require company membership
-- which is already enforced by RLS.

CREATE OR REPLACE FUNCTION check_quote_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin   boolean;
  v_can_approve boolean;
BEGIN
  -- No status change — nothing to check
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  -- Transitions to final/locked states require elevated permission
  IF NEW.status IN ('won', 'lost', 'accepted', 'rejected') THEN
    SELECT is_admin INTO v_is_admin
    FROM users WHERE id = auth.uid() AND is_active = true;

    IF NOT COALESCE(v_is_admin, false) THEN
      SELECT can_approve INTO v_can_approve
      FROM user_permissions
      WHERE user_id = auth.uid() AND module = 'quotes';

      IF NOT COALESCE(v_can_approve, false) THEN
        RAISE EXCEPTION 'Insufficient permissions to mark quote as %', NEW.status;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quote_status_transition_check ON quotes;
CREATE TRIGGER quote_status_transition_check
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION check_quote_status_transition();


-- ─── 2. Prevent quote_counter from being decreased ───────────────────────────

CREATE OR REPLACE FUNCTION prevent_quote_counter_decrease()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.quote_counter < OLD.quote_counter THEN
    RAISE EXCEPTION 'quote_counter cannot be decreased (would cause duplicate quote numbers)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_quote_counter_decrease ON companies;
CREATE TRIGGER prevent_quote_counter_decrease
  BEFORE UPDATE OF quote_counter ON companies
  FOR EACH ROW
  EXECUTE FUNCTION prevent_quote_counter_decrease();


