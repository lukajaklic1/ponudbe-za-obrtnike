-- New enquiries from the online configurator: a quote counts as new until someone opens it in the app.
-- viewed_at is set the first time a user opens the quote. Re-runnable.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

-- quotes made in the app are seen by the person who made them
UPDATE quotes SET viewed_at = COALESCE(viewed_at, created_at) WHERE COALESCE(source, 'manual') <> 'configurator';
