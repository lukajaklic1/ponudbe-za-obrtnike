-- Quote statuses that nothing sets any more are removed: accepted (= won), rejected (= lost), expired, frozen.
-- Rows that still have one of them are moved to the status that means the same.
-- Re-runnable. Paste into the SQL editor of the Fenestio project (not `supabase db push`).
UPDATE quotes SET status = 'won'   WHERE status = 'accepted';
UPDATE quotes SET status = 'lost'  WHERE status = 'rejected';
UPDATE quotes SET status = 'draft' WHERE status IN ('expired', 'frozen');

ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('enquiry','draft','issued','sent','downloaded','won','lost'));
