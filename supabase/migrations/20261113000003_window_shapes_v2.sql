-- 1) New window shapes: transom windows, special shape (price on request),
--    balcony door with fixed side light, PSK (parallel slide-tilt) door.
ALTER TABLE window_types DROP CONSTRAINT IF EXISTS window_types_template_check;
ALTER TABLE window_types ADD CONSTRAINT window_types_template_check CHECK (template IN (
  'fixed','tilt_turn','tilt','double','double_mullion','triple','fixed_tilt_turn',
  'tilt_turn_transom','double_transom','special',
  'door','door_double','door_side','lift_slide','psk'));

-- 2) Replace the trade abbreviation O/K with plain wording in already saved shapes
UPDATE window_types SET name = 'Enokrilno, odpiranje in kip', updated_at = now()
WHERE name IN ('Enokrilno (O/K)', 'Enokrilno okno (O/K)');

UPDATE window_types SET name = 'Fiksno + krilo na odpiranje in kip', updated_at = now()
WHERE name = 'Fiksno + O/K krilo';
