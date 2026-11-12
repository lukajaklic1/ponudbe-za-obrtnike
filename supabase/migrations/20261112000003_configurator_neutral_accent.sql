-- ============================================================
-- 20261112000003_configurator_neutral_accent.sql
-- The public configurator is linked from the supplier's own website, so its
-- default button colour is neutral black instead of blue. Companies that never
-- changed the colour (still the old blue default) get the new default too.
-- ============================================================

ALTER TABLE companies ALTER COLUMN configurator_accent SET DEFAULT '#101112';

UPDATE companies SET configurator_accent = '#101112'
WHERE configurator_accent = '#2563eb';
