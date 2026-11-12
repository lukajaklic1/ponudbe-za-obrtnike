-- ============================================================
-- 20261112000004_merge_issued_into_sent.sql
-- Quote statuses are now: Osnutek → Poslano → Pridobljeno / Izgubljeno.
-- "Izdano" (issued) is merged into "Poslano" (sent): issuing an offer marks it
-- as sent. Existing issued quotes move to sent (sent_at = when they were issued).
-- The 'issued' value stays allowed in the check constraint for safety.
-- ============================================================

UPDATE quotes
SET status     = 'sent',
    sent_at    = COALESCE(sent_at, issued_at, updated_at, now()),
    updated_at = now()
WHERE status = 'issued';
