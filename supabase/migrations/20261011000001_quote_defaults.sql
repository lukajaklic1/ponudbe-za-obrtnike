-- ============================================================
-- 20261011000001_quote_defaults.sql
-- Company-level quote defaults:
--  * payment_terms_list   — the company's usual payment terms (JSON array of strings)
--  * default_payment_terms — preselected on a new quote
--  * default_valid_days    — "valid until" = today + N days
--  * default_parity        — Incoterms code preselected on a new quote (optional)
-- quotes.parity already exists.
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS payment_terms_list jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_payment_terms text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_valid_days integer NOT NULL DEFAULT 30;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_parity text;

NOTIFY pgrst, 'reload schema';
