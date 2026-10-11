ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE POLICY "super_admin_users_update" ON users FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());
