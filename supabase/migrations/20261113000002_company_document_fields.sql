-- Company data required on quotes, pro-forma invoices and invoices (ZDDV-1 82. člen, ZGD-1 30. člen)
-- + public bucket for the company logo (shown on documents and on the public configurator).

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS website           text,
  ADD COLUMN IF NOT EXISTS bank_bic          text,
  ADD COLUMN IF NOT EXISTS representative    text,      -- zakoniti zastopnik / odgovorna oseba
  ADD COLUMN IF NOT EXISTS place_of_issue    text,      -- kraj izdaje (fallback: address_city)
  ADD COLUMN IF NOT EXISTS proforma_prefix   text NOT NULL DEFAULT 'PR',
  ADD COLUMN IF NOT EXISTS proforma_counter  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_exempt_note   text DEFAULT 'DDV ni obračunan na podlagi 1. odstavka 94. člena ZDDV-1.';

-- invoice_* columns already exist on most databases; make sure they do
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS invoice_prefix    text NOT NULL DEFAULT 'R',
  ADD COLUMN IF NOT EXISTS invoice_counter   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_due_days  integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS invoice_note      text;

-- Logo bucket: public read (configurator is anonymous), write only into own company folder
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos', 'logos', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Company members upload logo" ON storage.objects;
CREATE POLICY "Company members upload logo" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = (SELECT get_my_company_id()::text));

DROP POLICY IF EXISTS "Company members update logo" ON storage.objects;
CREATE POLICY "Company members update logo" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = (SELECT get_my_company_id()::text));

DROP POLICY IF EXISTS "Company members delete logo" ON storage.objects;
CREATE POLICY "Company members delete logo" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = (SELECT get_my_company_id()::text));

DROP POLICY IF EXISTS "Anyone reads logos" ON storage.objects;
CREATE POLICY "Anyone reads logos" ON storage.objects FOR SELECT
USING (bucket_id = 'logos');
