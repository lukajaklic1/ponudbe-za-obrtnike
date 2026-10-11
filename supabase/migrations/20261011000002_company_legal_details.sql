-- ============================================================
-- 20261011000002_company_legal_details.sql
-- Company details required on business documents (ZGD-1):
--  * s.p.:          firma, sedež, matična številka
--  * d.o.o. / d.d.: + registrski organ, osnovni kapital (+ nevplačani del)
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS legal_form text;               -- sp / doo / dd / other
ALTER TABLE companies ADD COLUMN IF NOT EXISTS registration_number text;      -- matična številka
ALTER TABLE companies ADD COLUMN IF NOT EXISTS registry_authority text;       -- registrski organ (npr. Okrožno sodišče v Ljubljani)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS share_capital numeric(14,2);   -- osnovni kapital
ALTER TABLE companies ADD COLUMN IF NOT EXISTS unpaid_capital numeric(14,2);  -- nevplačani osnovni kapital

NOTIFY pgrst, 'reload schema';
