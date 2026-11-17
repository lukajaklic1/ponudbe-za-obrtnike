-- ============================================================
-- 20261117000003_labour_margin.sql
-- Two margins: one on the window material (margin_pct), one on the labour (labour_margin_pct).
-- Labour can also be counted per metre of frame and mullions (labour_frame_m) and per metre of sash profile
-- (labour_sash_m), 0 when not set. Every pane of glass is billed at least glass_min_m2 (0 = real area).
-- The configurator gets the prices with margin unrounded, so its live price matches the quote to the cent.
-- Safe to run again.
-- Price lists without labour_margin_pct keep using the material margin for labour, so no price changes.
-- ============================================================

CREATE OR REPLACE FUNCTION window_spec_price(s window_systems, p jsonb, spec jsonb, w integer, h integer, color_pct numeric DEFAULT 0,
                                             glass_m2 numeric DEFAULT NULL, handle_cost numeric DEFAULT 0,
                                             sill_m numeric DEFAULT 0, items jsonb DEFAULT '[]'::jsonb)
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
  -- the glazier bills every pane at least this area
  gmin    numeric := COALESCE((p->>'glass_min_m2')::numeric, 0);
  sashes  integer := 0;
  handles integer := 0;
  hw      numeric := 0;
  waste   numeric := 1 + COALESCE((p->>'waste_pct')::numeric, 6) / 100;
  r       record;
  op      text;
  sw2     numeric; sh2 numeric; gw numeric; gh numeric;
  nt      integer; nb integer;
  nm      integer := 0;
  sp_main jsonb := COALESCE(spec->'main', '[]');
  cost    numeric;
  it      jsonb;
  -- sizes of the opening sashes added up (shading / screens priced per sash)
  s_w     numeric := 0;
  s_h     numeric := 0;
  s_a     numeric := 0;
  xs      numeric := 0;
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
      glass := glass + GREATEST(r.cw * r.ch / 1000000.0, gmin);
    ELSE
      sashes := sashes + 1;
      -- a passive sash is opened from the other one: no handle
      IF op IN ('tilt_turn', 'turn', 'tilt', 'slide_window', 'slide', 'lift_slide') THEN handles := handles + 1; END IF;
      sw2 := r.cw + 2 * ov; sh2 := r.ch + 2 * ov;
      s_w := s_w + sw2; s_h := s_h + sh2; s_a := s_a + sw2 * sh2 / 1000000.0;
      sash := sash + 2 * (sw2 + sh2);
      gw := GREATEST(0, sw2 - 2 * sw); gh := GREATEST(0, sh2 - 2 * sw);
      bead  := bead + 2 * (gw + gh);
      glass := glass + GREATEST(gw * gh / 1000000.0, gmin);
      -- hardware per sash = fixed + price per metre of the sash perimeter
      hw := hw + COALESCE((p->'hw'->>op)::numeric,
              CASE op WHEN 'tilt_turn' THEN 20 WHEN 'turn' THEN 15 WHEN 'tilt' THEN 18 WHEN 'passive' THEN 10 WHEN 'slide_window' THEN 40 WHEN 'slide' THEN 120 WHEN 'lift_slide' THEN 450 ELSE 0 END)
          + COALESCE((p->'hw_m'->>op)::numeric,
              CASE op WHEN 'tilt_turn' THEN 1 WHEN 'turn' THEN 1 WHEN 'tilt' THEN 1 WHEN 'passive' THEN 0.5 WHEN 'slide_window' THEN 2 WHEN 'slide' THEN 5 WHEN 'lift_slide' THEN 20 ELSE 0 END)
            * 2 * (sw2 + sh2) / 1000;
    END IF;
  END LOOP;

  -- shading, insect screens …: purchase price per m² of the window, per opening sash or per piece
  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(items, '[]'::jsonb)) LOOP
    -- per window: fixed + width × €/m + height × €/m + area × €/m² of the window;
    -- per sash: the same for every opening sash (summed over the sashes);
    -- min is the lowest SALE price: turned back into a cost so the margin brings it to exactly that price
    xs := xs + GREATEST(COALESCE((it->>'min')::numeric, 0) / (1 + COALESCE((p->>'margin_pct')::numeric, 45) / 100),
      CASE WHEN it->>'unit' = 'sash' THEN
             COALESCE((it->>'fixed')::numeric, 0) * sashes + COALESCE((it->>'per_w')::numeric, 0) * s_w / 1000.0
           + COALESCE((it->>'per_h')::numeric, 0) * s_h / 1000.0 + COALESCE((it->>'cost')::numeric, 0) * s_a
           ELSE
             COALESCE((it->>'fixed')::numeric, 0) + COALESCE((it->>'per_w')::numeric, 0) * w / 1000.0
           + COALESCE((it->>'per_h')::numeric, 0) * h / 1000.0 + COALESCE((it->>'cost')::numeric, 0) * w * h / 1000000.0
      END);
  END LOOP;

  -- material: profiles (with the colour surcharge) + glass + hardware + handles + sills + shading
  cost := ((2 * (w + h)) / 1000.0 * waste * COALESCE(s.frame_m, 0)
        + mull / 1000.0 * waste * COALESCE(s.mullion_m, 0)
        + sash / 1000.0 * waste * COALESCE(s.sash_m, 0)
        + bead / 1000.0 * waste * COALESCE(s.bead_m, 0)) * (1 + COALESCE(color_pct, 0) / 100)
        + glass * COALESCE(glass_m2, (p->>'glass_m2')::numeric, 32)
        + hw
        + handles * COALESCE(handle_cost, 0)
        + w / 1000.0 * COALESCE(sill_m, 0)
        + xs;
  -- the material margin goes on the material, the labour margin on the labour (same as material when not set)
  RETURN round(cost * (1 + COALESCE((p->>'margin_pct')::numeric, 45) / 100)
             + (COALESCE((p->>'labour_window')::numeric, 30) + sashes * COALESCE((p->>'labour_sash')::numeric, 22)
                + COALESCE((p->>'labour_frame_m')::numeric, 0) * ((2 * (w + h)) + mull) / 1000.0
                + COALESCE((p->>'labour_sash_m')::numeric, 0) * sash / 1000.0)
               * (1 + COALESCE((p->>'labour_margin_pct')::numeric, (p->>'margin_pct')::numeric, 45) / 100), 2);
END;
$$;

CREATE OR REPLACE FUNCTION get_configurator(p_slug text)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c  companies%ROWTYPE;
  mf numeric;
  lmf numeric;
  hw jsonb;
  hwm jsonb;
BEGIN
  SELECT * INTO c FROM companies WHERE configurator_slug = lower(p_slug) AND configurator_enabled = true;
  IF NOT FOUND THEN RETURN NULL; END IF;
  mf := 1 + COALESCE((c.window_pricing->>'margin_pct')::numeric, 45) / 100;
  lmf := 1 + COALESCE((c.window_pricing->>'labour_margin_pct')::numeric, (c.window_pricing->>'margin_pct')::numeric, 45) / 100;
  hw := '{"tilt_turn":20,"turn":15,"tilt":18,"passive":10,"slide_window":40,"slide":120,"lift_slide":450}'::jsonb || COALESCE(c.window_pricing->'hw', '{}'::jsonb);
  hwm := '{"tilt_turn":1,"turn":1,"tilt":1,"passive":0.5,"slide_window":2,"slide":5,"lift_slide":20}'::jsonb || COALESCE(c.window_pricing->'hw_m', '{}'::jsonb);

  RETURN json_build_object(
    'company', json_build_object(
      'name', c.name, 'logo_url', c.logo_url, 'email', c.email, 'phone', c.phone,
      'currency', c.currency, 'accent', c.configurator_accent, 'intro', c.configurator_intro,
      'show_prices', c.configurator_show_prices,
      'vat_rate', CASE WHEN COALESCE(c.vat_payer, true) THEN 22 ELSE 0 END
    ),
    'systems', COALESCE((SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'material', s.material, 'description', s.description, 'image_url', s.image_url,
        'applies_to', s.applies_to,
        'frame_w', s.frame_w, 'sash_w', s.sash_w, 'mullion_w', s.mullion_w,
        'frame_m', CASE WHEN c.configurator_show_prices THEN (s.frame_m * mf) END,
        'sash_m', CASE WHEN c.configurator_show_prices THEN (s.sash_m * mf) END,
        'mullion_m', CASE WHEN c.configurator_show_prices THEN (s.mullion_m * mf) END,
        'bead_m', CASE WHEN c.configurator_show_prices THEN (s.bead_m * mf) END,
        'min_price', CASE WHEN c.configurator_show_prices THEN s.min_price END) ORDER BY s.sort_order, s.name)
      FROM window_systems s WHERE s.company_id = c.id AND s.is_active), '[]'::json),
    'types', COALESCE((SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'template', t.template,
        'min_width', t.min_width, 'max_width', t.max_width, 'min_height', t.min_height, 'max_height', t.max_height) ORDER BY t.sort_order, t.name)
      FROM window_types t WHERE t.company_id = c.id AND t.is_active), '[]'::json),
    'prices', CASE WHEN c.configurator_show_prices THEN COALESCE((SELECT json_agg(json_build_object(
        'system_id', p.system_id, 'type_id', p.type_id, 'matrix', p.matrix, 'price_per_m2', p.price_per_m2, 'min_price', p.min_price))
      FROM window_prices p WHERE p.company_id = c.id), '[]'::json) ELSE '[]'::json END,
    'combos', COALESCE((SELECT json_agg(json_build_object('system_id', p.system_id, 'type_id', p.type_id))
      FROM window_prices p WHERE p.company_id = c.id), '[]'::json),
    'options', COALESCE((SELECT json_agg(json_build_object('id', o.id, 'group_key', o.group_key, 'name', o.name, 'description', o.description,
        'pricing', o.pricing, 'price', CASE WHEN c.configurator_show_prices THEN o.price ELSE NULL END,
        'price_piece', CASE WHEN c.configurator_show_prices THEN o.price_piece ELSE NULL END, 'per_item', o.per_item, 'is_default', o.is_default) ORDER BY o.group_key, o.sort_order, o.name)
      FROM window_options o WHERE o.company_id = c.id AND o.is_active), '[]'::json),
    -- windows built from sashes: only when the supplier set it up in the price list
    'builder', CASE WHEN COALESCE((c.window_pricing->'offer'->>'windows')::boolean, false) OR COALESCE((c.window_pricing->'offer'->>'slidingWindows')::boolean, false)
                      OR COALESCE((c.window_pricing->'offer'->>'doors')::boolean, false)
                      OR COALESCE((c.window_pricing->'offer'->>'sliding')::boolean, false)
                      OR (COALESCE((c.window_pricing->'offer'->>'roof')::boolean, true) AND c.window_pricing ? 'roof') THEN json_build_object(
      'offer', c.window_pricing->'offer',
      -- profile colours per material (surcharges in % only when prices are shown)
      'colors', (SELECT jsonb_object_agg(k, (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x->>'id', 'name', x->>'name', 'code', x->>'code', 'look', x->>'look',
                  'one', CASE WHEN c.configurator_show_prices THEN COALESCE((x->>'one')::numeric, 0) ELSE 0 END,
                  'both', CASE WHEN c.configurator_show_prices THEN COALESCE((x->>'both')::numeric, 0) ELSE 0 END)), '[]'::jsonb)
                FROM jsonb_array_elements(v) x))
                FROM jsonb_each(COALESCE(c.window_pricing->'colors', '{}'::jsonb)) AS e(k, v)),
      -- glass packages and handles: purchase prices with the margin folded in (0 when prices are hidden)
      'glass', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', g->>'id', 'name', g->>'name', 'description', g->>'description', 'ug', (g->>'ug')::numeric, 'layers', (g->>'layers')::integer,
                  'cost_m2', CASE WHEN c.configurator_show_prices THEN (COALESCE((g->>'cost_m2')::numeric, 0) * mf) ELSE 0 END) ORDER BY i), '[]'::jsonb)
                FROM jsonb_array_elements(COALESCE(c.window_pricing->'glass', '[]'::jsonb)) WITH ORDINALITY AS t(g, i)),
      'handles', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x->>'id', 'name', x->>'name', 'look', x->>'look', 'code', x->>'code', 'image_url', x->>'image_url', 'lockable', COALESCE((x->>'lockable')::boolean, false),
                  'cost', CASE WHEN c.configurator_show_prices THEN (COALESCE((x->>'cost')::numeric, 0) * mf) ELSE 0 END) ORDER BY i), '[]'::jsonb)
                FROM jsonb_array_elements(COALESCE(c.window_pricing->'handles', '[]'::jsonb)) WITH ORDINALITY AS t(x, i)),
      -- window sills (inside / outside): purchase price per metre with the margin folded in
      'sills', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x->>'id', 'side', x->>'side', 'name', x->>'name', 'description', x->>'description',
                  'material', x->>'material', 'image_url', x->>'image_url',
                  'cost_m', CASE WHEN c.configurator_show_prices THEN (COALESCE((x->>'cost_m')::numeric, 0) * mf) ELSE 0 END) ORDER BY i), '[]'::jsonb)
                FROM jsonb_array_elements(COALESCE(c.window_pricing->'sills', '[]'::jsonb)) WITH ORDINALITY AS t(x, i)),
      -- shading and insect screens: purchase price with the margin folded in
      'shading', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x->>'id', 'kind', x->>'kind', 'name', x->>'name', 'description', x->>'description',
                  'unit', x->>'unit', 'icon', x->>'icon', 'image_url', x->>'image_url',
                  'cost', CASE WHEN c.configurator_show_prices THEN (COALESCE((x->>'cost')::numeric, 0) * mf) ELSE 0 END,
                  'fixed', CASE WHEN c.configurator_show_prices THEN (COALESCE((x->>'fixed')::numeric, 0) * mf) ELSE 0 END,
                  'per_w', CASE WHEN c.configurator_show_prices THEN (COALESCE((x->>'per_w')::numeric, 0) * mf) ELSE 0 END,
                  'per_h', CASE WHEN c.configurator_show_prices THEN (COALESCE((x->>'per_h')::numeric, 0) * mf) ELSE 0 END,
                  'min', CASE WHEN c.configurator_show_prices THEN round(COALESCE((x->>'min')::numeric, 0), 2) ELSE 0 END,
                  'allows_screen', COALESCE((x->>'allows_screen')::boolean, false),
                  'can_integrate', COALESCE((x->>'can_integrate')::boolean, false),
                  'integrated', CASE WHEN x ? 'integrated' THEN jsonb_build_object(
                      'fixed', CASE WHEN c.configurator_show_prices THEN (COALESCE((x->'integrated'->>'fixed')::numeric, 0) * mf) ELSE 0 END,
                      'per_w', CASE WHEN c.configurator_show_prices THEN (COALESCE((x->'integrated'->>'per_w')::numeric, 0) * mf) ELSE 0 END,
                      'per_h', CASE WHEN c.configurator_show_prices THEN (COALESCE((x->'integrated'->>'per_h')::numeric, 0) * mf) ELSE 0 END,
                      'cost', CASE WHEN c.configurator_show_prices THEN (COALESCE((x->'integrated'->>'cost')::numeric, 0) * mf) ELSE 0 END) END) ORDER BY i), '[]'::jsonb)
                FROM jsonb_array_elements(COALESCE(c.window_pricing->'shading', '[]'::jsonb)) WITH ORDINALITY AS t(x, i)),
      -- roof windows: catalogue of models in standard sizes; sale prices (no margin)
      'roof', CASE WHEN COALESCE((c.window_pricing->'offer'->>'roof')::boolean, true) AND c.window_pricing ? 'roof' THEN json_build_object(
        'models', (SELECT COALESCE(json_agg(json_build_object('id', m->>'id', 'name', m->>'name', 'opening', m->>'opening',
            'brand', m->>'brand', 'description', m->>'description', 'image_url', m->>'image_url', 'datasheet_url', m->>'datasheet_url',
            'variants', (SELECT COALESCE(json_agg(json_build_object('id', v->>'id', 'name', v->>'name',
                'pct', CASE WHEN c.configurator_show_prices THEN COALESCE((v->>'pct')::numeric, 0) END)), '[]'::json)
              FROM jsonb_array_elements(COALESCE(m->'variants', '[]'::jsonb)) v),
            'sizes', (SELECT COALESCE(json_agg(json_build_object('id', z->>'id', 'w', (z->>'w')::numeric, 'h', (z->>'h')::numeric,
                'price', CASE WHEN c.configurator_show_prices THEN round((z->>'price')::numeric, 2) END)), '[]'::json)
              FROM jsonb_array_elements(COALESCE(m->'sizes', '[]'::jsonb)) z))), '[]'::json)
          FROM jsonb_array_elements(COALESCE(c.window_pricing->'roof'->'models', '[]'::jsonb)) m),
        'flashings', (SELECT COALESCE(json_agg(json_build_object('id', f->>'id', 'name', f->>'name',
            'price', CASE WHEN c.configurator_show_prices THEN round((f->>'price')::numeric, 2) END)), '[]'::json)
          FROM jsonb_array_elements(COALESCE(c.window_pricing->'roof'->'flashings', '[]'::jsonb)) f)) END,
      'pricing', CASE WHEN c.configurator_show_prices THEN json_build_object(
        'hw', (SELECT jsonb_object_agg(k, (v::numeric * mf)) FROM jsonb_each_text(hw) AS t(k, v)),
        'hw_m', (SELECT jsonb_object_agg(k, (v::numeric * mf)) FROM jsonb_each_text(hwm) AS t(k, v)),
        'glass_m2', (COALESCE((c.window_pricing->>'glass_m2')::numeric, 32) * mf),
        'glass_min_m2', COALESCE((c.window_pricing->>'glass_min_m2')::numeric, 0),
        'labour_window', (COALESCE((c.window_pricing->>'labour_window')::numeric, 30) * lmf),
        'labour_sash', (COALESCE((c.window_pricing->>'labour_sash')::numeric, 22) * lmf),
        'labour_frame_m', (COALESCE((c.window_pricing->>'labour_frame_m')::numeric, 0) * lmf),
        'labour_sash_m', (COALESCE((c.window_pricing->>'labour_sash_m')::numeric, 0) * lmf),
        'waste_pct', COALESCE((c.window_pricing->>'waste_pct')::numeric, 6),
        'margin_pct', 0, 'labour_margin_pct', 0,
        'both_sides_pct', COALESCE((c.window_pricing->>'both_sides_pct')::numeric, 10)) END) END
  );
END;
$$;
