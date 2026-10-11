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
