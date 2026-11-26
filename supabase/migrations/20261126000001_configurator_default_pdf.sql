-- New companies start with: live prices + the customer downloads the quote right away.
-- Existing companies keep whatever they have chosen, except the retired "customer chooses" mode, which becomes "pdf".
UPDATE companies SET configurator_end_mode = 'pdf' WHERE configurator_end_mode = 'choose';
ALTER TABLE companies ALTER COLUMN configurator_end_mode SET DEFAULT 'pdf';
