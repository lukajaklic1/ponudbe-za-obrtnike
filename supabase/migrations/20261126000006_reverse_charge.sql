-- Reverse charge (obrnjena davcna obveznost) on a quote: VAT 0 % and a note on the offer.
-- Re-runnable. Paste into the SQL editor of the Fenestio project (not `supabase db push`).
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS reverse_charge boolean NOT NULL DEFAULT false;
