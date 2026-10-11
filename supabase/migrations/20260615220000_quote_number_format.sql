-- ============================================================
-- 20260615220000_quote_number_format.sql  (QuotePro migration 027)
-- Quote number: no dashes, 4-digit counter, default prefix 'Q'.
-- e.g. Q20260001
-- ============================================================

ALTER TABLE companies ALTER COLUMN quote_prefix SET DEFAULT 'Q';
UPDATE companies SET quote_prefix = 'Q' WHERE quote_prefix = 'QUO';

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
  UPDATE companies
  SET quote_counter = quote_counter + 1
  WHERE id = p_company_id
  RETURNING quote_counter, quote_prefix INTO v_number, v_prefix;

  RETURN COALESCE(v_prefix, 'Q') || to_char(now(), 'YYYY') || lpad(v_number::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_quote_number(uuid) TO authenticated;
