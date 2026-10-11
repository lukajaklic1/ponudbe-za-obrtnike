-- ============================================================
-- 20260615250000_perm_materials.sql  (QuotePro migration 030)
-- Add 'materials' to allowed permission modules.
-- ============================================================

ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_module_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_module_check
  CHECK (module IN ('quotes','customers','materials','machine_rates','labor_rates','overheads'));
