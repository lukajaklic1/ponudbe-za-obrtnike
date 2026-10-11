-- ============================================================
-- 20260626010000_quotations_update_policy.sql
-- Allow company members to UPDATE their own objects in the
-- quotations bucket, so thumbnail upserts (upsert: true) work
-- when a thumbnail is regenerated for the same path.
-- ============================================================

DROP POLICY IF EXISTS "Company members can update quotations" ON storage.objects;
CREATE POLICY "Company members can update quotations"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'quotations'
  AND (storage.foldername(name))[1] = (SELECT get_my_company_id()::text)
)
WITH CHECK (
  bucket_id = 'quotations'
  AND (storage.foldername(name))[1] = (SELECT get_my_company_id()::text)
);
