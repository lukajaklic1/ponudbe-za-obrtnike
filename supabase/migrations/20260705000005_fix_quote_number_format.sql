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
