-- ============================================================
-- 20260615200000_quote_prefix.sql  (QuotePro migration 025)
-- Configurable quote number prefix + RPC uses it.
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS quote_prefix text NOT NULL DEFAULT 'QUO';

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

  RETURN COALESCE(v_prefix, 'QUO') || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_number::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_quote_number(uuid) TO authenticated;
