-- Profiles are priced per metre (like window makers calculate): frame, sash, mullion/transom
-- and glazing bead, plus the visible widths needed to compute sash and glass sizes.
-- Hardware per opening type, base glass, labour, waste and margin live in companies.window_pricing.
-- price_per_m2 / min_price stay: the price list derives them from the metre costing so the
-- current configurator keeps working until it is rebuilt on the same costing.

ALTER TABLE window_systems
  ADD COLUMN IF NOT EXISTS frame_m    numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sash_m     numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mullion_m  numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bead_m     numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frame_w    integer NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS sash_w     integer NOT NULL DEFAULT 78,
  ADD COLUMN IF NOT EXISTS mullion_w  integer NOT NULL DEFAULT 82;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS window_pricing jsonb NOT NULL DEFAULT '{}'::jsonb;
