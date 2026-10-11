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
