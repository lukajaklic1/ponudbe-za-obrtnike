-- ============================================================
-- 20260617030000_quotations_bucket_mime.sql  (QuotePro migration 034)
-- Quote attachments accept CAD / email / any file type, not just PDF/images.
-- Lift the mime-type whitelist and raise the size limit to 50 MB.
-- ============================================================

UPDATE storage.buckets
SET allowed_mime_types = NULL,        -- allow any file type (CAD, .eml, .msg, ...)
    file_size_limit    = 52428800     -- 50 MB
WHERE id = 'quotations';
