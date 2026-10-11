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
