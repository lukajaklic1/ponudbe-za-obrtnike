-- Obrtdesk namestitev — KORAK 5 od 6
-- Samo za PRAZEN Supabase projekt. Prilepi celoto v SQL Editor in klikni Run.
-- vsebuje: 20260705000008_security_fixes5.sql … 20261010000003_quote_assignee.sql

-- ===== 20260705000008_security_fixes5.sql =====
-- Security fixes round 5
-- CRIT-1: restrict generate_quote_number to admins / users with quotes:create
-- HIGH-1: companies INSERT — only allow when user has no profile yet
-- HIGH-2: handle_onboarding — guard against race condition / double call
-- HIGH-3: users INSERT — block raw inserts entirely (RPCs are the only safe path)
-- HIGH-4: accept_invitation — add token validation
-- MED-1:  restrict DELETE on quotes/customers/machines/labor_rates to admins
-- MED-4:  fix is_my_admin() and has_perm() to check is_active


-- ─── CRIT-1: generate_quote_number — restrict to admin or quotes:create ──────
CREATE OR REPLACE FUNCTION generate_quote_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
  v_prefix text;
  v_is_admin boolean;
  v_can_create boolean;
BEGIN
  IF get_my_company_id() != p_company_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT is_admin INTO v_is_admin FROM users WHERE id = auth.uid() AND is_active = true;

  IF NOT COALESCE(v_is_admin, false) THEN
    SELECT can_create INTO v_can_create FROM user_permissions
    WHERE user_id = auth.uid() AND module = 'quotes';
    IF NOT COALESCE(v_can_create, false) THEN
      RAISE EXCEPTION 'Insufficient permissions to create a quote number';
    END IF;
  END IF;

  UPDATE companies
  SET quote_counter = quote_counter + 1
  WHERE id = p_company_id
  RETURNING quote_counter, quote_prefix INTO v_number, v_prefix;

  RETURN COALESCE(v_prefix, 'Q') || to_char(now(), 'YYYY') || lpad(v_number::text, 4, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION generate_quote_number(uuid) TO authenticated;


-- ─── HIGH-1: companies INSERT — only if caller has no profile yet ─────────────
DROP POLICY IF EXISTS "companies_insert" ON companies;
DROP POLICY IF EXISTS "Anyone can create a company" ON companies;
DROP POLICY IF EXISTS "Authenticated users can create companies" ON companies;

CREATE POLICY "companies_insert" ON companies FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
  );


-- ─── HIGH-2: handle_onboarding — idempotency guard + race fix ────────────────
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

  -- Idempotency: if user already has a profile, return existing data
  SELECT company_id INTO v_company_id FROM users WHERE id = v_user_id FOR UPDATE;
  IF FOUND THEN
    RETURN json_build_object('company_id', v_company_id, 'user_id', v_user_id);
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.companies (name, currency, po_prefix, po_next_number)
  VALUES (p_company_name, 'EUR', 'PO', 1)
  RETURNING id INTO v_company_id;

  INSERT INTO public.users (id, company_id, first_name, last_name, email, is_admin)
  VALUES (v_user_id, v_company_id, p_first_name, p_last_name, v_user_email, true);

  RETURN json_build_object('company_id', v_company_id, 'user_id', v_user_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.handle_onboarding TO authenticated;


-- ─── HIGH-3: users INSERT — block direct inserts, RPCs are the only path ──────
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users: insert own profile" ON users;

CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated
  WITH CHECK (false);


-- ─── HIGH-4: accept_invitation — validate token ───────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
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

  IF EXISTS (SELECT 1 FROM users WHERE id = v_uid) THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  -- Validate both email AND token
  SELECT * INTO v_inv
  FROM user_invitations
  WHERE lower(email) = lower(v_email)
    AND token = p_token
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
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
      SET can_view    = EXCLUDED.can_view,
          can_create  = EXCLUDED.can_create,
          can_approve = EXCLUDED.can_approve,
          can_pay     = EXCLUDED.can_pay;
  END IF;

  UPDATE user_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  RETURN json_build_object('company_id', v_inv.company_id);
END;
$$;

-- Old no-arg version is replaced — drop it first
DROP FUNCTION IF EXISTS public.accept_invitation();
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;


-- ─── MED-1: Admin-only DELETE on sensitive tables ─────────────────────────────
-- quotes
DROP POLICY IF EXISTS "quotes_delete" ON quotes;
CREATE POLICY "quotes_delete" ON quotes FOR DELETE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
  );

-- customers
DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_delete" ON customers FOR DELETE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
  );

-- machines / workstations
DROP POLICY IF EXISTS "machines_delete" ON machines;
CREATE POLICY "machines_delete" ON machines FOR DELETE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "workstations_delete" ON workstations;
CREATE POLICY "workstations_delete" ON workstations FOR DELETE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
  );

-- labor_rates
DROP POLICY IF EXISTS "labor_rates_delete" ON labor_rates;
CREATE POLICY "labor_rates_delete" ON labor_rates FOR DELETE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
  );

-- materials
DROP POLICY IF EXISTS "materials_delete" ON materials;
CREATE POLICY "materials_delete" ON materials FOR DELETE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
  );


-- ─── MED-4: is_my_admin() and has_perm() — add is_active check ───────────────
CREATE OR REPLACE FUNCTION is_my_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true),
    false
  );
$$;

CREATE OR REPLACE FUNCTION has_perm(p_module text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_result   boolean;
BEGIN
  SELECT is_admin INTO v_is_admin
  FROM users WHERE id = auth.uid() AND is_active = true;

  IF COALESCE(v_is_admin, false) THEN RETURN true; END IF;

  SELECT CASE p_action
    WHEN 'view'    THEN can_view
    WHEN 'create'  THEN can_create
    WHEN 'approve' THEN can_approve
    WHEN 'pay'     THEN can_pay
    ELSE false
  END INTO v_result
  FROM user_permissions
  WHERE user_id = auth.uid() AND module = p_module;

  RETURN COALESCE(v_result, false);
END;
$$;


-- ===== 20260718000001_super_admin.sql =====
-- Super admin: platform-level admin (Toolingdesk staff only)
-- One person, set manually in SQL editor. Never exposed via UI.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- Helper function
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM users WHERE id = auth.uid()),
    false
  );
$$;

-- Super admin can read ALL companies
CREATE POLICY "super_admin_companies_select" ON companies FOR SELECT TO authenticated
  USING (is_super_admin());

-- Super admin can read ALL users
CREATE POLICY "super_admin_users_select" ON users FOR SELECT TO authenticated
  USING (is_super_admin());

-- Super admin can update companies (activate/deactivate)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE POLICY "super_admin_companies_update" ON companies FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- RPC: get platform stats for super admin
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_companies      integer;
  v_users          integer;
  v_new_this_month integer;
  v_growth         json;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COUNT(*) INTO v_companies FROM companies;
  SELECT COUNT(*) INTO v_users FROM users WHERE is_active = true;
  SELECT COUNT(*) INTO v_new_this_month FROM companies
    WHERE created_at >= date_trunc('month', now());

  SELECT json_agg(row ORDER BY row.month) INTO v_growth FROM (
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
           COUNT(*)::integer AS count
    FROM companies
    WHERE created_at >= now() - interval '12 months'
    GROUP BY 1
  ) row;

  RETURN json_build_object(
    'total_companies', v_companies,
    'total_users', v_users,
    'new_this_month', v_new_this_month,
    'growth', COALESCE(v_growth, '[]'::json)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_platform_stats() TO authenticated;


-- ===== 20260718000002_super_admin_users_active.sql =====
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE POLICY "super_admin_users_update" ON users FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());


-- ===== 20260718000003_platform_stats_user_growth.sql =====
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_companies      integer;
  v_users          integer;
  v_new_this_month integer;
  v_growth         json;
  v_user_growth    json;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COUNT(*) INTO v_companies FROM companies;
  SELECT COUNT(*) INTO v_users FROM users WHERE is_active = true;
  SELECT COUNT(*) INTO v_new_this_month FROM companies
    WHERE created_at >= date_trunc('month', now());

  SELECT json_agg(row ORDER BY row.month) INTO v_growth FROM (
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
           COUNT(*)::integer AS count
    FROM companies
    WHERE created_at >= now() - interval '12 months'
    GROUP BY 1
  ) row;

  SELECT json_agg(row ORDER BY row.month) INTO v_user_growth FROM (
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
           COUNT(*)::integer AS count
    FROM users
    WHERE created_at >= now() - interval '12 months'
    GROUP BY 1
  ) row;

  RETURN json_build_object(
    'total_companies', v_companies,
    'total_users', v_users,
    'new_this_month', v_new_this_month,
    'growth', COALESCE(v_growth, '[]'::json),
    'user_growth', COALESCE(v_user_growth, '[]'::json)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_platform_stats() TO authenticated;


-- ===== 20260718000004_registration_notification.sql =====
-- Enable pg_net extension for HTTP calls from DB functions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Modify handle_onboarding to notify super admin after successful registration
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

  -- Idempotency: if user already has a profile, return existing data
  SELECT company_id INTO v_company_id FROM users WHERE id = v_user_id FOR UPDATE;
  IF FOUND THEN
    RETURN json_build_object('company_id', v_company_id, 'user_id', v_user_id);
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.companies (name, currency, po_prefix, po_next_number)
  VALUES (p_company_name, 'EUR', 'PO', 1)
  RETURNING id INTO v_company_id;

  INSERT INTO public.users (id, company_id, first_name, last_name, email, is_admin)
  VALUES (v_user_id, v_company_id, p_first_name, p_last_name, v_user_email, true);

  -- Notify super admin asynchronously (fire-and-forget)
  PERFORM net.http_post(
    url     := (SELECT value FROM vault.secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/notify-registration',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'supabase_anon_key' LIMIT 1)
    ),
    body    := jsonb_build_object(
      'company_name', p_company_name,
      'first_name',   p_first_name,
      'last_name',    p_last_name,
      'email',        v_user_email
    )
  );

  RETURN json_build_object('company_id', v_company_id, 'user_id', v_user_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.handle_onboarding TO authenticated;


-- ===== 20260805000001_materials_updated_by.sql =====
-- Add updated_by to materials table (mirrors machines & labor_rates pattern)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL;


-- ===== 20260805000002_companies_oh_updated_by.sql =====
-- Track who last saved overhead settings
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_updated_by uuid REFERENCES users(id) ON DELETE SET NULL;


-- ===== 20260806000001_dashboard_status_assignee_filter.sql =====
-- ============================================================
-- 20260806000001_dashboard_status_assignee_filter.sql
-- Add optional p_status and p_assignee_id filters to all
-- dashboard RPCs: get_quote_dashboard_stats, get_quote_trends,
-- get_customer_stats
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- get_quote_trends
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_quote_trends(uuid, integer, uuid);

CREATE OR REPLACE FUNCTION get_quote_trends(
  p_company_id  uuid,
  p_months      integer DEFAULT 12,
  p_customer_id uuid    DEFAULT NULL,
  p_status      text    DEFAULT NULL,
  p_assignee_id uuid    DEFAULT NULL
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
      COUNT(DISTINCT CASE WHEN (p_status IS NULL AND q.status IN ('sent','won','lost'))
                            OR (p_status IS NOT NULL AND q.status = p_status)
                          THEN q.id END)::integer AS sent_count,
      COALESCE(SUM(CASE WHEN (p_status IS NULL AND q.status IN ('sent','won','lost'))
                          OR (p_status IS NOT NULL AND q.status = p_status)
                        THEN c.annual_value ELSE 0 END), 0) AS sent_value,
      COUNT(DISTINCT CASE WHEN q.status = 'won' THEN q.id END)::integer AS realized_count,
      COALESCE(SUM(CASE WHEN q.status = 'won' THEN c.annual_value ELSE 0 END), 0) AS realized_value
    FROM quotes q
    LEFT JOIN quote_items qi ON qi.quote_id = q.id
    LEFT JOIN calculations c ON c.quote_item_id = qi.id
    WHERE q.company_id = p_company_id
      AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
      AND (p_assignee_id IS NULL OR q.assignee_id = p_assignee_id)
      AND q.created_at >= date_trunc('month', NOW()) - ((p_months - 1) || ' months')::interval
    GROUP BY date_trunc('month', q.created_at)
  ) t ON t.month_bucket = m
  ORDER BY m;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quote_trends(uuid, integer, uuid, text, uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- get_customer_stats
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_customer_stats(uuid);

CREATE OR REPLACE FUNCTION get_customer_stats(
  p_company_id  uuid,
  p_status      text DEFAULT NULL,
  p_assignee_id uuid DEFAULT NULL
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
    COALESCE(SUM(CASE WHEN (p_status IS NULL AND q.status IN ('sent','won','lost'))
                        OR (p_status IS NOT NULL AND q.status = p_status)
                      THEN calc.annual_value ELSE 0 END), 0)::numeric AS sent_value,
    COALESCE(SUM(CASE WHEN q.status = 'won' THEN calc.annual_value ELSE 0 END), 0)::numeric AS realized_value,
    COUNT(DISTINCT CASE WHEN (p_status IS NULL AND q.status IN ('sent','won','lost'))
                          OR (p_status IS NOT NULL AND q.status = p_status)
                        THEN q.id END)::integer AS sent_count,
    COUNT(DISTINCT CASE WHEN q.status = 'won' THEN q.id END)::integer AS realized_count,
    CASE
      WHEN COUNT(DISTINCT CASE WHEN (p_status IS NULL AND q.status IN ('sent','won','lost'))
                                 OR (p_status IS NOT NULL AND q.status = p_status)
                               THEN q.id END) > 0 THEN
        ROUND(
          COUNT(DISTINCT CASE WHEN q.status = 'won' THEN q.id END)::numeric
          / COUNT(DISTINCT CASE WHEN (p_status IS NULL AND q.status IN ('sent','won','lost'))
                                   OR (p_status IS NOT NULL AND q.status = p_status)
                               THEN q.id END)::numeric
          * 100, 1
        )
      ELSE 0
    END::numeric AS win_rate
  FROM customers cust
  LEFT JOIN quotes q ON q.customer_id = cust.id AND q.company_id = p_company_id
    AND (p_assignee_id IS NULL OR q.assignee_id = p_assignee_id)
  LEFT JOIN quote_items qi ON qi.quote_id = q.id
  LEFT JOIN calculations calc ON calc.quote_item_id = qi.id
  WHERE cust.company_id = p_company_id
  GROUP BY cust.id, cust.name
  ORDER BY COALESCE(SUM(CASE WHEN (p_status IS NULL AND q.status IN ('sent','won','lost'))
                               OR (p_status IS NOT NULL AND q.status = p_status)
                             THEN calc.annual_value ELSE 0 END), 0) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_customer_stats(uuid, text, uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- get_quote_dashboard_stats
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_quote_dashboard_stats(uuid, uuid);

CREATE OR REPLACE FUNCTION get_quote_dashboard_stats(
  p_company_id  uuid,
  p_customer_id uuid DEFAULT NULL,
  p_status      text DEFAULT NULL,
  p_assignee_id uuid DEFAULT NULL
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
    AND (p_customer_id IS NULL OR customer_id = p_customer_id)
    AND (p_assignee_id IS NULL OR assignee_id = p_assignee_id);

  RETURN json_build_object(
    'pipeline_value', (
      SELECT COALESCE(SUM(c.annual_value), 0)
      FROM calculations c
      JOIN quote_items qi ON qi.id = c.quote_item_id
      JOIN quotes q       ON q.id  = qi.quote_id
      WHERE q.company_id = p_company_id
        AND ((p_status IS NULL AND q.status IN ('sent','won','lost')) OR (p_status IS NOT NULL AND q.status = p_status))
        AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
        AND (p_assignee_id IS NULL OR q.assignee_id = p_assignee_id)
    ),
    'win_rate', CASE WHEN (v_won + v_lost) > 0
                     THEN round((v_won::numeric / (v_won + v_lost)) * 100, 1)
                     ELSE 0 END,
    'won_90d',  v_won,
    'lost_90d', v_lost,
    'active_quotes', (
      SELECT COUNT(*) FROM quotes
      WHERE company_id = p_company_id
        AND ((p_status IS NULL AND status IN ('sent','won','lost')) OR (p_status IS NOT NULL AND status = p_status))
        AND (p_customer_id IS NULL OR customer_id = p_customer_id)
        AND (p_assignee_id IS NULL OR assignee_id = p_assignee_id)
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
        AND (p_assignee_id IS NULL OR q.assignee_id = p_assignee_id)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_quote_dashboard_stats(uuid, uuid, text, uuid) TO authenticated;


-- ===== 20260806000002_dashboard_filters_fix.sql =====
-- ============================================================
-- 20260806000002_dashboard_filters_fix.sql
-- Fix: sent_count/sent_value always count sent+won+lost.
-- Status filter only applies to customer_stats table.
-- Assignee filter works on all three functions.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- get_quote_trends — period + customer + assignee filters only
-- (no status filter — sent always = sent+won+lost, realized = won)
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_quote_trends(uuid, integer, uuid, text, uuid);
DROP FUNCTION IF EXISTS get_quote_trends(uuid, integer, uuid);
DROP FUNCTION IF EXISTS get_quote_trends(uuid, integer);

CREATE OR REPLACE FUNCTION get_quote_trends(
  p_company_id  uuid,
  p_months      integer DEFAULT 12,
  p_customer_id uuid    DEFAULT NULL,
  p_assignee_id uuid    DEFAULT NULL
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
      COUNT(DISTINCT CASE WHEN q.status IN ('sent','won','lost') THEN q.id END)::integer AS sent_count,
      COALESCE(SUM(CASE WHEN q.status IN ('sent','won','lost') THEN c.annual_value ELSE 0 END), 0) AS sent_value,
      COUNT(DISTINCT CASE WHEN q.status = 'won' THEN q.id END)::integer AS realized_count,
      COALESCE(SUM(CASE WHEN q.status = 'won' THEN c.annual_value ELSE 0 END), 0) AS realized_value
    FROM quotes q
    LEFT JOIN quote_items qi ON qi.quote_id = q.id
    LEFT JOIN calculations c ON c.quote_item_id = qi.id
    WHERE q.company_id = p_company_id
      AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
      AND (p_assignee_id IS NULL OR q.assignee_id = p_assignee_id)
      AND q.created_at >= date_trunc('month', NOW()) - ((p_months - 1) || ' months')::interval
    GROUP BY date_trunc('month', q.created_at)
  ) t ON t.month_bucket = m
  ORDER BY m;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quote_trends(uuid, integer, uuid, uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- get_customer_stats — customer + assignee + status filters
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_customer_stats(uuid, text, uuid);
DROP FUNCTION IF EXISTS get_customer_stats(uuid);

CREATE OR REPLACE FUNCTION get_customer_stats(
  p_company_id  uuid,
  p_assignee_id uuid DEFAULT NULL,
  p_status      text DEFAULT NULL
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
    COALESCE(SUM(CASE WHEN q.status = 'won' THEN calc.annual_value ELSE 0 END), 0)::numeric AS realized_value,
    COUNT(DISTINCT CASE WHEN q.status IN ('sent','won','lost') THEN q.id END)::integer AS sent_count,
    COUNT(DISTINCT CASE WHEN q.status = 'won' THEN q.id END)::integer AS realized_count,
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
  LEFT JOIN quotes q ON q.customer_id = cust.id
    AND q.company_id = p_company_id
    AND (p_assignee_id IS NULL OR q.assignee_id = p_assignee_id)
    AND (p_status IS NULL OR q.status = p_status)
  LEFT JOIN quote_items qi ON qi.quote_id = q.id
  LEFT JOIN calculations calc ON calc.quote_item_id = qi.id
  WHERE cust.company_id = p_company_id
  GROUP BY cust.id, cust.name
  ORDER BY COALESCE(SUM(CASE WHEN q.status IN ('sent','won','lost') THEN calc.annual_value ELSE 0 END), 0) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_customer_stats(uuid, uuid, text) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- get_quote_dashboard_stats — customer + assignee filters only
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_quote_dashboard_stats(uuid, uuid, text, uuid);
DROP FUNCTION IF EXISTS get_quote_dashboard_stats(uuid, uuid);
DROP FUNCTION IF EXISTS get_quote_dashboard_stats(uuid);

CREATE OR REPLACE FUNCTION get_quote_dashboard_stats(
  p_company_id  uuid,
  p_customer_id uuid DEFAULT NULL,
  p_assignee_id uuid DEFAULT NULL
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
    AND (p_customer_id IS NULL OR customer_id = p_customer_id)
    AND (p_assignee_id IS NULL OR assignee_id = p_assignee_id);

  RETURN json_build_object(
    'pipeline_value', (
      SELECT COALESCE(SUM(c.annual_value), 0)
      FROM calculations c
      JOIN quote_items qi ON qi.id = c.quote_item_id
      JOIN quotes q       ON q.id  = qi.quote_id
      WHERE q.company_id = p_company_id
        AND q.status IN ('sent','won','lost')
        AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
        AND (p_assignee_id IS NULL OR q.assignee_id = p_assignee_id)
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
        AND (p_assignee_id IS NULL OR assignee_id = p_assignee_id)
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
        AND (p_assignee_id IS NULL OR q.assignee_id = p_assignee_id)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_quote_dashboard_stats(uuid, uuid, uuid) TO authenticated;


-- ===== 20260807000001_add_created_by.sql =====
-- Add created_by to machines, labor_rates, materials
ALTER TABLE machines     ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE labor_rates  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE materials    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;


-- ===== 20261010000001_obrtdesk_trades.sql =====
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


-- ===== 20261010000002_quote_number_dashes.sql =====
-- ============================================================
-- 20261010000002_quote_number_dashes.sql
-- Quote numbers with dashes for readability: P-2026-0001
-- (same counter + permission rules as before)
-- ============================================================

CREATE OR REPLACE FUNCTION generate_quote_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
  v_prefix text;
  v_is_admin boolean;
  v_can_create boolean;
BEGIN
  IF get_my_company_id() != p_company_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT is_admin INTO v_is_admin FROM users WHERE id = auth.uid() AND is_active = true;

  IF NOT COALESCE(v_is_admin, false) THEN
    SELECT can_create INTO v_can_create FROM user_permissions
    WHERE user_id = auth.uid() AND module = 'quotes';
    IF NOT COALESCE(v_can_create, false) THEN
      RAISE EXCEPTION 'Insufficient permissions to create a quote number';
    END IF;
  END IF;

  UPDATE companies
  SET quote_counter = quote_counter + 1
  WHERE id = p_company_id
  RETURNING quote_counter, quote_prefix INTO v_number, v_prefix;

  RETURN COALESCE(NULLIF(v_prefix, ''), 'P') || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_number::text, 4, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION generate_quote_number(uuid) TO authenticated;


-- ===== 20261010000003_quote_assignee.sql =====
-- ============================================================
-- 20261010000003_quote_assignee.sql
-- quotes.assignee_id ("Odgovorna oseba") was used by the app and the
-- dashboard RPCs but never created by a migration.
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_assignee ON quotes(assignee_id);

-- Existing quotes: the person who created them is responsible
UPDATE quotes SET assignee_id = created_by WHERE assignee_id IS NULL;

NOTIFY pgrst, 'reload schema';


