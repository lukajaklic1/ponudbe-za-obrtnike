-- ============================================================
-- 20261114000001_mullion_rule.sql
-- Window price: a mullion is left out only between a passive sash and the sash it closes
-- against (three sashes: the passive middle sash still has a mullion on its other side).
-- Same rule as meetsWithoutMullion in src/lib/costing.ts.
-- ============================================================

CREATE OR REPLACE FUNCTION window_spec_price(s window_systems, p jsonb, spec jsonb, w integer, h integer)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE
  fw      numeric := COALESCE(NULLIF(s.frame_w, 0), 70);
  sw      numeric := COALESCE(NULLIF(s.sash_w, 0), 78);
  mw      numeric := COALESCE(NULLIF(s.mullion_w, 0), 82);
  ov      numeric := 8;
  n       integer := LEAST(4, GREATEST(1, COALESCE((spec->>'sashes')::integer, 1)));
  top_b   text := COALESCE(spec->>'top', 'none');
  bot_b   text := COALESCE(spec->>'bottom', 'none');
  top_h   numeric := 0;
  bot_h   numeric := 0;
  inner_w numeric := w - 2 * fw;
  main_h  numeric;
  mull    numeric := 0;
  sash    numeric := 0;
  bead    numeric := 0;
  glass   numeric := 0;
  sashes  integer := 0;
  hw      numeric := 0;
  waste   numeric := 1 + COALESCE((p->>'waste_pct')::numeric, 6) / 100;
  r       record;
  op      text;
  sw2     numeric; sh2 numeric; gw numeric; gh numeric;
  nt      integer; nb integer;
  nm      integer := 0;
  sp_main jsonb := COALESCE(spec->'main', '[]');
  cost    numeric;
BEGIN
  IF top_b <> 'none' THEN top_h := round(h * COALESCE((spec->>'topRatio')::numeric, 0.28)); END IF;
  IF bot_b <> 'none' THEN bot_h := round(h * COALESCE((spec->>'bottomRatio')::numeric, 0.28)); END IF;
  main_h := GREATEST(0, (CASE WHEN bot_h > 0 THEN h - bot_h - mw / 2 ELSE h - fw END) - (CASE WHEN top_h > 0 THEN top_h + mw / 2 ELSE fw END));
  nt := CASE WHEN top_b <> 'none' THEN GREATEST(1, jsonb_array_length(COALESCE(spec->'topFields', '[]'))) ELSE 0 END;
  nb := CASE WHEN bot_b <> 'none' THEN GREATEST(1, jsonb_array_length(COALESCE(spec->'bottomFields', '[]'))) ELSE 0 END;

  -- no mullion only between a passive sash and the sash it closes against:
  -- passive hinged left meets the sash on its right, hinged right the one on its left (no hinge: either side)
  FOR i IN 1 .. n - 1 LOOP
    IF NOT (
         (COALESCE(sp_main->(i - 1)->>'opening', '') = 'passive' AND COALESCE(sp_main->(i - 1)->>'hinge', '') <> 'right')
      OR (COALESCE(sp_main->i->>'opening', '') = 'passive' AND COALESCE(sp_main->i->>'hinge', '') <> 'left')
      OR COALESCE(sp_main->(i - 1)->>'opening', '') IN ('slide_window', 'slide')
      OR COALESCE(sp_main->i->>'opening', '') IN ('slide_window', 'slide')
    ) THEN nm := nm + 1; END IF;
  END LOOP;
  mull := nm * main_h;
  IF nt > 0 THEN mull := mull + inner_w + (nt - 1) * GREATEST(0, top_h - fw - mw / 2); END IF;
  IF nb > 0 THEN mull := mull + inner_w + (nb - 1) * GREATEST(0, bot_h - fw - mw / 2); END IF;

  FOR r IN
    SELECT e AS f, (inner_w - nm * mw) / n AS cw, main_h AS ch FROM jsonb_array_elements(sp_main) e
    UNION ALL
    SELECT e, (inner_w - (nt - 1) * mw) / GREATEST(nt, 1), top_h - fw - mw / 2 FROM jsonb_array_elements(CASE WHEN nt > 0 THEN spec->'topFields' ELSE '[]'::jsonb END) e
    UNION ALL
    SELECT e, (inner_w - (nb - 1) * mw) / GREATEST(nb, 1), bot_h - fw - mw / 2 FROM jsonb_array_elements(CASE WHEN nb > 0 THEN spec->'bottomFields' ELSE '[]'::jsonb END) e
  LOOP
    IF r.cw <= 0 OR r.ch <= 0 THEN CONTINUE; END IF;
    op := COALESCE(r.f->>'opening', 'fixed');
    IF op = 'fixed' THEN
      bead  := bead + 2 * (r.cw + r.ch);
      glass := glass + r.cw * r.ch / 1000000;
    ELSE
      sashes := sashes + 1;
      sw2 := r.cw + 2 * ov; sh2 := r.ch + 2 * ov;
      sash := sash + 2 * (sw2 + sh2);
      gw := GREATEST(0, sw2 - 2 * sw); gh := GREATEST(0, sh2 - 2 * sw);
      bead  := bead + 2 * (gw + gh);
      glass := glass + gw * gh / 1000000;
      -- hardware per sash = fixed + price per metre of the sash perimeter
      hw := hw + COALESCE((p->'hw'->>op)::numeric,
              CASE op WHEN 'tilt_turn' THEN 20 WHEN 'turn' THEN 15 WHEN 'tilt' THEN 18 WHEN 'passive' THEN 10 WHEN 'slide_window' THEN 40 WHEN 'slide' THEN 120 WHEN 'lift_slide' THEN 450 ELSE 0 END)
          + COALESCE((p->'hw_m'->>op)::numeric,
              CASE op WHEN 'tilt_turn' THEN 1 WHEN 'turn' THEN 1 WHEN 'tilt' THEN 1 WHEN 'passive' THEN 0.5 WHEN 'slide_window' THEN 2 WHEN 'slide' THEN 5 WHEN 'lift_slide' THEN 20 ELSE 0 END)
            * 2 * (sw2 + sh2) / 1000;
    END IF;
  END LOOP;

  cost := (2 * (w + h)) / 1000.0 * waste * COALESCE(s.frame_m, 0)
        + mull / 1000.0 * waste * COALESCE(s.mullion_m, 0)
        + sash / 1000.0 * waste * COALESCE(s.sash_m, 0)
        + bead / 1000.0 * waste * COALESCE(s.bead_m, 0)
        + glass * COALESCE((p->>'glass_m2')::numeric, 32)
        + hw
        + COALESCE((p->>'labour_window')::numeric, 30) + sashes * COALESCE((p->>'labour_sash')::numeric, 22);
  RETURN round(cost * (1 + COALESCE((p->>'margin_pct')::numeric, 45) / 100), 2);
END;
$$;
