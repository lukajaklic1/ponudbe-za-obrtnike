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
