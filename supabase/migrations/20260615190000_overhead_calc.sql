-- ============================================================
-- 20260615190000_overhead_calc.sql  (QuotePro migration 024)
-- Cost-center inputs that DERIVE the overhead_* percentages.
-- pct = cost-center pool / base (annual). Stored on companies.
-- ============================================================

-- Annual indirect costs per cost centre
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_cc_material      numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_cc_manufacturing numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_cc_sga           numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_cc_logistics     numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_cc_rd            numeric(14,2) NOT NULL DEFAULT 0;

-- Annual direct cost bases
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_base_material      numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_base_manufacturing numeric(14,2) NOT NULL DEFAULT 0;
