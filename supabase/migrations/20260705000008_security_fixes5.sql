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
