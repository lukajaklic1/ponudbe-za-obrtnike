-- ============================================================
-- 20261011000004_delete_guards.sql
-- Enforce the delete rules in the database too (not only in the UI):
--  * a service used on any quote cannot be deleted (deactivate instead)
--  * only draft quotes can be deleted
-- ============================================================

-- Services: block delete when referenced by a quote line
CREATE OR REPLACE FUNCTION prevent_used_price_item_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM quote_lines WHERE price_item_id = OLD.id) THEN
    RAISE EXCEPTION 'Te storitve ni mogoče izbrisati, ker je uporabljena v ponudbah. Storitev je možno deaktivirati.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS price_item_delete_guard ON price_items;
CREATE TRIGGER price_item_delete_guard
  BEFORE DELETE ON price_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_used_price_item_delete();

-- Quotes: admins may delete drafts only
DROP POLICY IF EXISTS "quotes_delete" ON quotes;
CREATE POLICY "quotes_delete" ON quotes FOR DELETE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND status = 'draft'
    AND (SELECT is_admin FROM users WHERE id = auth.uid() AND is_active = true)
  );
