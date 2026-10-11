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
