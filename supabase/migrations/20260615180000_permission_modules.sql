-- ============================================================
-- 20260615180000_permission_modules.sql  (QuotePro migration 023)
-- Replace procurement permission modules with QuotePro sections.
-- ============================================================

ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_module_check;
DELETE FROM user_permissions WHERE module NOT IN ('quotes','customers','machine_rates','labor_rates');
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_module_check
  CHECK (module IN ('quotes','customers','machine_rates','labor_rates'));
