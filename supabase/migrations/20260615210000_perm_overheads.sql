-- ============================================================
-- 20260615210000_perm_overheads.sql  (QuotePro migration 026)
-- Add 'overheads' to allowed permission modules.
-- ============================================================

ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_module_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_module_check
  CHECK (module IN ('quotes','customers','machine_rates','labor_rates','overheads'));
