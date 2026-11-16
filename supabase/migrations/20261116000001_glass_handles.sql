-- ============================================================
-- 20261116000001_glass_handles.sql
-- Glass packages and handles in the price list (window_pricing.glass / .handles), purchase prices:
-- glass per m² of glass, handle per sash with a handle; the margin goes on the whole window.
-- The first glass / handle is the standard one (included). The configurator gets them with the
-- margin folded in; the server prices the chosen glass / handle and writes them on the quote line.
-- ============================================================

DROP FUNCTION IF EXISTS window_spec_price(window_systems, jsonb, jsonb, integer, integer, numeric);

CREATE OR REPLACE FUNCTION window_spec_price(s window_systems, p jsonb, spec jsonb, w integer, h integer, color_pct numeric DEFAULT 0,
                                             glass_m2 numeric DEFAULT NULL, handle_cost numeric DEFAULT 0)
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
      -- a passive sash is opened from the other one: no handle
      IF op IN ('tilt_turn', 'turn', 'tilt', 'slide_window', 'slide', 'lift_slide') THEN handles := handles + 1; END IF;
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

  -- profiles (with the colour surcharge) + glass + hardware + handles + labour
  cost := ((2 * (w + h)) / 1000.0 * waste * COALESCE(s.frame_m, 0)
        + mull / 1000.0 * waste * COALESCE(s.mullion_m, 0)
        + sash / 1000.0 * waste * COALESCE(s.sash_m, 0)
        + bead / 1000.0 * waste * COALESCE(s.bead_m, 0)) * (1 + COALESCE(color_pct, 0) / 100)
        + glass * COALESCE(glass_m2, (p->>'glass_m2')::numeric, 32)
        + hw
        + handles * COALESCE(handle_cost, 0)
        + COALESCE((p->>'labour_window')::numeric, 30) + sashes * COALESCE((p->>'labour_sash')::numeric, 22);
  RETURN round(cost * (1 + COALESCE((p->>'margin_pct')::numeric, 45) / 100), 2);
END;
$$;

CREATE OR REPLACE FUNCTION get_configurator(p_slug text)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c  companies%ROWTYPE;
  mf numeric;
  hw jsonb;
  hwm jsonb;
BEGIN
  SELECT * INTO c FROM companies WHERE configurator_slug = lower(p_slug) AND configurator_enabled = true;
  IF NOT FOUND THEN RETURN NULL; END IF;
  mf := 1 + COALESCE((c.window_pricing->>'margin_pct')::numeric, 45) / 100;
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
        'frame_m', CASE WHEN c.configurator_show_prices THEN round(s.frame_m * mf, 2) END,
        'sash_m', CASE WHEN c.configurator_show_prices THEN round(s.sash_m * mf, 2) END,
        'mullion_m', CASE WHEN c.configurator_show_prices THEN round(s.mullion_m * mf, 2) END,
        'bead_m', CASE WHEN c.configurator_show_prices THEN round(s.bead_m * mf, 2) END,
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
        'pricing', o.pricing, 'price', CASE WHEN c.configurator_show_prices THEN o.price ELSE NULL END, 'is_default', o.is_default) ORDER BY o.group_key, o.sort_order, o.name)
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
                  'cost_m2', CASE WHEN c.configurator_show_prices THEN round(COALESCE((g->>'cost_m2')::numeric, 0) * mf, 2) ELSE 0 END) ORDER BY i), '[]'::jsonb)
                FROM jsonb_array_elements(COALESCE(c.window_pricing->'glass', '[]'::jsonb)) WITH ORDINALITY AS t(g, i)),
      'handles', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x->>'id', 'name', x->>'name', 'look', x->>'look', 'lockable', COALESCE((x->>'lockable')::boolean, false),
                  'cost', CASE WHEN c.configurator_show_prices THEN round(COALESCE((x->>'cost')::numeric, 0) * mf, 2) ELSE 0 END) ORDER BY i), '[]'::jsonb)
                FROM jsonb_array_elements(COALESCE(c.window_pricing->'handles', '[]'::jsonb)) WITH ORDINALITY AS t(x, i)),
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
        'hw', (SELECT jsonb_object_agg(k, round(v::numeric * mf, 2)) FROM jsonb_each_text(hw) AS t(k, v)),
        'hw_m', (SELECT jsonb_object_agg(k, round(v::numeric * mf, 2)) FROM jsonb_each_text(hwm) AS t(k, v)),
        'glass_m2', round(COALESCE((c.window_pricing->>'glass_m2')::numeric, 32) * mf, 2),
        'labour_window', round(COALESCE((c.window_pricing->>'labour_window')::numeric, 30) * mf, 2),
        'labour_sash', round(COALESCE((c.window_pricing->>'labour_sash')::numeric, 22) * mf, 2),
        'waste_pct', COALESCE((c.window_pricing->>'waste_pct')::numeric, 6),
        'margin_pct', 0,
        'both_sides_pct', COALESCE((c.window_pricing->>'both_sides_pct')::numeric, 10)) END) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION submit_configuration(p_slug text, p_customer jsonb, p_items jsonb, p_note text DEFAULT NULL, p_services jsonb DEFAULT '[]'::jsonb)
RETURNS json
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c            companies%ROWTYPE;
  v_owner      uuid;
  v_email      text := lower(trim(COALESCE(p_customer->>'email', '')));
  v_first      text := trim(COALESCE(p_customer->>'first_name', ''));
  v_last       text := trim(COALESCE(p_customer->>'last_name', ''));
  v_customer   uuid;
  v_quote      uuid;
  v_number     integer;
  v_qnum       text;
  v_vat        numeric;
  v_item       jsonb;
  v_pos        integer := 0;
  v_sys        window_systems%ROWTYPE;
  v_typ        window_types%ROWTYPE;
  v_w          integer;
  v_h          integer;
  v_qty        integer;
  v_area       numeric;
  v_base       numeric;
  v_unit       numeric;
  v_opt        window_options%ROWTYPE;
  v_opt_names  text[];
  v_opt_ids    uuid[];
  v_opts       jsonb;
  v_color      text;
  v_spec       jsonb;
  v_rm         jsonb;
  v_rs         jsonb;
  v_rf         jsonb;
  v_clist      jsonb;
  v_cout       jsonb;
  v_cin        jsonb;
  v_cpct       numeric;
  v_cname      text;
  v_glass      jsonb;
  v_handle     jsonb;
  v_rv         jsonb;
  v_n          integer;
  v_tname      text;
  v_net        numeric := 0;
  v_line_net   numeric;
  v_hinge      text;
  -- totals over all windows, for services priced per piece / m² / metre
  v_sum_pcs    numeric := 0;
  v_sum_area   numeric := 0;
  v_sum_perim  numeric := 0;
  v_sum_width  numeric := 0;
  v_sum_base   numeric := 0;
  v_svc_qty    numeric;
  v_svc_unit   text;
  v_svc_price  numeric;
BEGIN
  SELECT * INTO c FROM companies WHERE configurator_slug = lower(p_slug) AND configurator_enabled = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'configurator_not_found'; END IF;

  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF v_first = '' AND v_last = '' THEN RAISE EXCEPTION 'name_required'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  IF (SELECT count(*) FROM quotes q JOIN customers cu ON cu.id = q.customer_id
      WHERE q.company_id = c.id AND q.source = 'configurator' AND lower(cu.email) = v_email
        AND q.created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT id INTO v_owner FROM users WHERE company_id = c.id AND is_admin AND COALESCE(is_active, true)
  ORDER BY created_at LIMIT 1;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'no_owner'; END IF;

  SELECT id INTO v_customer FROM customers WHERE company_id = c.id AND lower(email) = v_email ORDER BY created_at LIMIT 1;
  IF v_customer IS NULL THEN
    INSERT INTO customers (company_id, name, customer_type, first_name, last_name, email, phone, address, notes)
    VALUES (c.id, trim(v_first || ' ' || v_last), 'person', NULLIF(v_first, ''), NULLIF(v_last, ''), v_email,
            NULLIF(trim(COALESCE(p_customer->>'phone', '')), ''), NULLIF(trim(COALESCE(p_customer->>'address', '')), ''),
            'Spletni konfigurator')
    RETURNING id INTO v_customer;
  END IF;

  UPDATE companies SET quote_counter = quote_counter + 1 WHERE id = c.id
  RETURNING quote_counter INTO v_number;
  v_qnum := COALESCE(NULLIF(c.quote_prefix, ''), 'P') || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_number::text, 4, '0');

  v_vat := CASE WHEN COALESCE(c.vat_payer, true) THEN 22 ELSE 0 END;

  INSERT INTO quotes (company_id, customer_id, quote_number, title, status, source, created_by, assignee_id,
                      site_address, notes, valid_until, payment_terms, contact_email, contact_phone)
  VALUES (c.id, v_customer, v_qnum, trim(v_first || ' ' || v_last), 'draft', 'configurator', v_owner, v_owner,
          NULLIF(trim(COALESCE(p_customer->>'address', '')), ''), NULLIF(trim(COALESCE(p_note, '')), ''),
          current_date + COALESCE(c.default_valid_days, 30), c.default_payment_terms,
          v_email, NULLIF(trim(COALESCE(p_customer->>'phone', '')), ''))
  RETURNING id INTO v_quote;

  -- ── windows ────────────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pos := v_pos + 1;

    -- roof window from the catalogue (model + size + flashing), priced on the server
    IF v_item ? 'roof' THEN
      v_rm := NULL; v_rs := NULL; v_rf := NULL; v_rv := NULL;
      SELECT m INTO v_rm FROM jsonb_array_elements(COALESCE(c.window_pricing->'roof'->'models', '[]'::jsonb)) m
      WHERE m->>'id' = v_item->'roof'->>'model' LIMIT 1;
      IF v_rm IS NULL OR NOT COALESCE((c.window_pricing->'offer'->>'roof')::boolean, true) THEN RAISE EXCEPTION 'invalid_type'; END IF;
      SELECT z INTO v_rs FROM jsonb_array_elements(COALESCE(v_rm->'sizes', '[]'::jsonb)) z WHERE z->>'id' = v_item->'roof'->>'size' LIMIT 1;
      IF v_rs IS NULL THEN RAISE EXCEPTION 'size_out_of_range'; END IF;
      IF COALESCE(v_item->'roof'->>'flashing', '') <> '' THEN
        SELECT f INTO v_rf FROM jsonb_array_elements(COALESCE(c.window_pricing->'roof'->'flashings', '[]'::jsonb)) f
        WHERE f->>'id' = v_item->'roof'->>'flashing' LIMIT 1;
      END IF;
      -- material / colour of the model: surcharge in % on the size price
      IF COALESCE(v_item->'roof'->>'variant', '') <> '' THEN
        SELECT v INTO v_rv FROM jsonb_array_elements(COALESCE(v_rm->'variants', '[]'::jsonb)) v WHERE v->>'id' = v_item->'roof'->>'variant' LIMIT 1;
      END IF;
      v_qty  := GREATEST(1, LEAST(100, COALESCE((v_item->>'quantity')::integer, 1)));
      -- catalogue products: the prices are sale prices, no margin is added
      v_unit := round((v_rs->>'price')::numeric * (1 + COALESCE((v_rv->>'pct')::numeric, 0) / 100) + COALESCE((v_rf->>'price')::numeric, 0), 2);
      v_w := round((v_rs->>'w')::numeric * 10); v_h := round((v_rs->>'h')::numeric * 10);
      v_line_net := round(v_unit * v_qty, 2);
      v_net := v_net + v_line_net;
      v_sum_pcs   := v_sum_pcs + v_qty;
      v_sum_area  := v_sum_area + (v_w::numeric * v_h::numeric) / 1000000 * v_qty;
      v_sum_perim := v_sum_perim + 2 * (v_w + v_h) / 1000.0 * v_qty;
      v_sum_width := v_sum_width + v_w / 1000.0 * v_qty;
      v_sum_base  := v_sum_base + v_unit * v_qty;
      INSERT INTO quote_lines (quote_id, company_id, position, room, name, description, unit, quantity, unit_price,
                               discount_pct, vat_rate, total_net, config)
      VALUES (v_quote, c.id, v_pos, NULLIF(trim(COALESCE(v_item->>'label', '')), ''),
              'Strešno okno ' || concat_ws(' ', NULLIF(v_rm->>'brand', ''), v_rm->>'name') || COALESCE(', ' || NULLIF(v_rv->>'name', ''), '') || ' ' || (v_rs->>'w') || ' × ' || (v_rs->>'h') || ' cm',
              NULLIF(COALESCE(v_rf->>'name', ''), ''),
              'pcs', v_qty, v_unit, 0, v_vat, v_line_net,
              jsonb_build_object('template', 'roof', 'roof', v_item->'roof', 'type_name', 'Strešno okno', 'model_name', v_rm->>'name',
                                 'opening', v_rm->>'opening', 'width', v_w, 'height', v_h, 'flashing_name', v_rf->>'name',
                                 'brand', v_rm->>'brand', 'variant_name', v_rv->>'name', 'image_url', v_rm->>'image_url'));
      CONTINUE;
    END IF;
    SELECT * INTO v_sys FROM window_systems WHERE id = (v_item->>'system_id')::uuid AND company_id = c.id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_system'; END IF;
    v_spec := v_item->'spec';
    -- a built product only with a profile the supplier uses for that product group
    IF v_spec IS NOT NULL AND v_sys.applies_to IS NOT NULL AND NOT (
         CASE v_spec->>'kind' WHEN 'sliding' THEN 'slidingWindows' WHEN 'door' THEN 'doors' WHEN 'wall' THEN 'walls' ELSE 'windows' END = ANY (v_sys.applies_to)
       ) THEN RAISE EXCEPTION 'invalid_system'; END IF;
    IF v_spec IS NULL THEN
      SELECT * INTO v_typ FROM window_types WHERE id = (v_item->>'type_id')::uuid AND company_id = c.id AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'invalid_type'; END IF;
      v_tname := v_typ.name;
    ELSE
      -- window built from sashes: only what the supplier offers
      v_n := COALESCE((v_spec->>'sashes')::integer, 0);
      IF v_n < 1 OR v_n > 4
         OR (v_spec->>'kind' = 'sliding' AND NOT COALESCE((c.window_pricing->'offer'->>'slidingWindows')::boolean, true))
         OR (v_spec->>'kind' = 'door' AND NOT COALESCE((c.window_pricing->'offer'->>'doors')::boolean, false))
         OR (v_spec->>'kind' = 'wall' AND NOT COALESCE((c.window_pricing->'offer'->>'sliding')::boolean, false))
         OR (COALESCE(v_spec->>'kind', '') NOT IN ('sliding', 'door', 'wall') AND NOT COALESCE((c.window_pricing->'offer'->>'windows')::boolean, false)) THEN RAISE EXCEPTION 'invalid_type'; END IF;
      v_typ := NULL;
      v_tname := CASE WHEN v_spec->>'kind' = 'sliding' THEN 'Drsno okno'
                      WHEN v_spec->>'kind' = 'wall' THEN CASE v_n WHEN 2 THEN 'Dvodelna drsna stena' WHEN 3 THEN 'Tridelna drsna stena' ELSE 'Štiridelna drsna stena' END
                      WHEN v_spec->>'kind' = 'door' THEN CASE v_n WHEN 1 THEN 'Enokrilna balkonska vrata' WHEN 2 THEN 'Dvokrilna balkonska vrata' ELSE 'Trokrilna balkonska vrata' END
                      WHEN v_n = 1 THEN 'Enokrilno okno' WHEN v_n = 2 THEN 'Dvokrilno okno' WHEN v_n = 3 THEN 'Trokrilno okno' ELSE 'Štirikrilno okno' END
        || CASE WHEN v_spec->>'top' IN ('single','split') THEN ' z nadsvetlobo' ELSE '' END
        || CASE WHEN v_spec->>'bottom' IN ('single','split') THEN ' z ločenim spodnjim delom' ELSE '' END;
    END IF;

    v_w   := (v_item->>'width')::integer;
    v_h   := (v_item->>'height')::integer;
    v_qty := GREATEST(1, LEAST(100, COALESCE((v_item->>'quantity')::integer, 1)));
    IF (v_spec IS NULL AND (v_w < v_typ.min_width OR v_w > v_typ.max_width OR v_h < v_typ.min_height OR v_h > v_typ.max_height))
       OR (v_spec IS NOT NULL AND (v_w < 300 * v_n OR v_w > 1600 * v_n OR v_h < 300 OR v_h > 2800)) THEN
      RAISE EXCEPTION 'size_out_of_range';
    END IF;
    v_hinge := CASE WHEN v_item->>'hinge' = 'right' THEN 'right' ELSE 'left' END;

    v_area := (v_w::numeric * v_h::numeric) / 1000000;
    -- colour of the profiles (outside / inside) from the colours of the profile's material; missing = the first one
    v_cpct := 0; v_cname := NULL; v_cout := NULL; v_cin := NULL;
    v_clist := c.window_pricing->'colors'->v_sys.material;
    IF v_spec IS NOT NULL AND jsonb_typeof(v_clist) = 'array' AND jsonb_array_length(v_clist) > 0 THEN
      SELECT x INTO v_cout FROM jsonb_array_elements(v_clist) x WHERE x->>'id' = v_item->'colors'->>'out' LIMIT 1;
      SELECT x INTO v_cin  FROM jsonb_array_elements(v_clist) x WHERE x->>'id' = v_item->'colors'->>'in' LIMIT 1;
      v_cout := COALESCE(v_cout, v_clist->0); v_cin := COALESCE(v_cin, v_clist->0);
      v_cpct := CASE
        WHEN (COALESCE((v_cout->>'one')::numeric, 0) <> 0 OR COALESCE((v_cout->>'both')::numeric, 0) <> 0)
         AND (COALESCE((v_cin->>'one')::numeric, 0) <> 0 OR COALESCE((v_cin->>'both')::numeric, 0) <> 0)
          THEN GREATEST(COALESCE((v_cout->>'both')::numeric, 0), COALESCE((v_cin->>'both')::numeric, 0))
        WHEN COALESCE((v_cout->>'one')::numeric, 0) <> 0 OR COALESCE((v_cout->>'both')::numeric, 0) <> 0 THEN COALESCE((v_cout->>'one')::numeric, 0)
        WHEN COALESCE((v_cin->>'one')::numeric, 0) <> 0 OR COALESCE((v_cin->>'both')::numeric, 0) <> 0 THEN COALESCE((v_cin->>'one')::numeric, 0)
        ELSE 0 END;
      v_cname := CASE WHEN v_cout->>'id' = v_cin->>'id' THEN 'barva ' || (v_cout->>'name')
                      ELSE 'zunaj ' || (v_cout->>'name') || ', znotraj ' || (v_cin->>'name') END;
    END IF;
    -- glass package and handle: the chosen one or the first (standard) one
    v_glass := NULL; v_handle := NULL;
    IF v_spec IS NOT NULL THEN
      SELECT g INTO v_glass FROM jsonb_array_elements(COALESCE(c.window_pricing->'glass', '[]'::jsonb)) g WHERE g->>'id' = v_item->>'glass' LIMIT 1;
      v_glass := COALESCE(v_glass, c.window_pricing->'glass'->0);
      SELECT x INTO v_handle FROM jsonb_array_elements(COALESCE(c.window_pricing->'handles', '[]'::jsonb)) x WHERE x->>'id' = v_item->>'handle' LIMIT 1;
      v_handle := COALESCE(v_handle, c.window_pricing->'handles'->0);
    END IF;
    v_base := CASE WHEN v_spec IS NULL THEN COALESCE(window_base_price(v_sys.id, v_typ.id, v_w, v_h), 0)
                   ELSE GREATEST(COALESCE(v_sys.min_price, 0), window_spec_price(v_sys, c.window_pricing, v_spec, v_w, v_h, v_cpct,
                          (v_glass->>'cost_m2')::numeric, COALESCE((v_handle->>'cost')::numeric, 0))) END;
    v_unit := v_base;
    v_opt_names := ARRAY[]::text[];
    v_opt_ids   := ARRAY[]::uuid[];
    v_opts      := '[]'::jsonb;
    v_color     := NULL;

    -- extras on the window itself (services are handled per order below)
    FOR v_opt IN
      SELECT o.* FROM window_options o
      WHERE o.company_id = c.id AND o.is_active
        AND o.group_key NOT IN ('installation','removal','finishing','transport')
        AND o.pricing <> 'flat'
        AND o.id IN (SELECT (x)::uuid FROM jsonb_array_elements_text(COALESCE(v_item->'option_ids', '[]')) x)
      ORDER BY o.group_key, o.sort_order
    LOOP
      v_unit := v_unit + CASE v_opt.pricing
        WHEN 'piece'     THEN v_opt.price
        WHEN 'm2'        THEN v_opt.price * v_area
        WHEN 'percent'   THEN v_base * v_opt.price / 100
        WHEN 'perimeter' THEN v_opt.price * 2 * (v_w + v_h) / 1000.0
        WHEN 'width'     THEN v_opt.price * v_w / 1000.0
        ELSE 0 END;
      v_opt_names := v_opt_names || v_opt.name;
      v_opt_ids   := v_opt_ids || v_opt.id;
      v_opts      := v_opts || jsonb_build_array(jsonb_build_object('group', v_opt.group_key, 'name', v_opt.name));
      IF v_opt.group_key = 'color' AND v_opt.description ~* '^#[0-9a-f]{6}$' THEN v_color := v_opt.description; END IF;
    END LOOP;

    v_unit := round(v_unit, 2);
    v_line_net := round(v_unit * v_qty, 2);
    v_net := v_net + v_line_net;

    v_sum_pcs   := v_sum_pcs + v_qty;
    v_sum_area  := v_sum_area + v_area * v_qty;
    v_sum_perim := v_sum_perim + 2 * (v_w + v_h) / 1000.0 * v_qty;
    v_sum_width := v_sum_width + v_w / 1000.0 * v_qty;
    v_sum_base  := v_sum_base + v_base * v_qty;

    INSERT INTO quote_lines (quote_id, company_id, position, room, name, description, unit, quantity, unit_price,
                             discount_pct, vat_rate, total_net, config)
    VALUES (v_quote, c.id, v_pos, NULLIF(trim(COALESCE(v_item->>'label', '')), ''),
            v_tname || ' ' || v_w || ' × ' || v_h || ' mm',
            v_sys.name || COALESCE(', ' || v_cname, '') || COALESCE(', ' || (v_glass->>'name'), '') || COALESCE(', ' || (v_handle->>'name'), '') || CASE WHEN array_length(v_opt_names, 1) > 0 THEN ' · ' || array_to_string(v_opt_names, ', ') ELSE '' END,
            'pcs', v_qty, v_unit, 0, v_vat, v_line_net,
            jsonb_build_object('system_id', v_sys.id, 'type_id', v_typ.id, 'template', COALESCE(v_typ.template, 'spec'), 'spec', v_spec,
                               'width', v_w, 'height', v_h, 'hinge', v_hinge, 'option_ids', to_jsonb(v_opt_ids),
                               -- frozen copy: the line keeps looking the same after the price list changes
                               'type_name', v_tname, 'system_name', v_sys.name, 'material', v_sys.material,
                               'image_url', v_sys.image_url, 'color', COALESCE(v_color, CASE WHEN v_cout->>'look' ~* '^#[0-9a-f]{6}' THEN substr(v_cout->>'look', 1, 7) END), 'options', v_opts,
                               'colors', jsonb_build_object('out', v_cout->>'name', 'in', v_cin->>'name', 'out_look', v_cout->>'look', 'in_look', v_cin->>'look', 'pct', v_cpct),
                               'glass', CASE WHEN v_glass IS NOT NULL THEN jsonb_build_object('name', v_glass->>'name', 'ug', v_glass->'ug') END,
                               'handle', CASE WHEN v_handle IS NOT NULL THEN jsonb_build_object('name', v_handle->>'name', 'look', v_handle->>'look') END));
  END LOOP;

  -- ── services for the whole order (one line each, quantity summed over all windows) ──
  FOR v_opt IN
    SELECT o.* FROM window_options o
    WHERE o.company_id = c.id AND o.is_active
      AND (o.group_key IN ('installation','removal','finishing','transport') OR o.pricing = 'flat')
      AND o.id IN (SELECT (x)::uuid FROM jsonb_array_elements_text(COALESCE(p_services, '[]')) x)
    ORDER BY o.group_key, o.sort_order
  LOOP
    v_pos := v_pos + 1;
    v_svc_price := v_opt.price;
    CASE v_opt.pricing
      WHEN 'piece'     THEN v_svc_qty := v_sum_pcs;   v_svc_unit := 'pcs';
      WHEN 'm2'        THEN v_svc_qty := v_sum_area;  v_svc_unit := 'm2';
      WHEN 'perimeter' THEN v_svc_qty := v_sum_perim; v_svc_unit := 'm';
      WHEN 'width'     THEN v_svc_qty := v_sum_width; v_svc_unit := 'm';
      WHEN 'percent'   THEN v_svc_qty := 1;           v_svc_unit := 'lump'; v_svc_price := v_sum_base * v_opt.price / 100;
      ELSE                  v_svc_qty := 1;           v_svc_unit := 'lump';
    END CASE;
    v_svc_qty   := round(v_svc_qty, 2);
    v_svc_price := round(v_svc_price, 2);
    v_line_net  := round(v_svc_qty * v_svc_price, 2);
    v_net := v_net + v_line_net;

    INSERT INTO quote_lines (quote_id, company_id, position, room, name, description, unit, quantity, unit_price,
                             discount_pct, vat_rate, total_net)
    VALUES (v_quote, c.id, v_pos, NULL, v_opt.name, v_opt.description, v_svc_unit, v_svc_qty, v_svc_price, 0, v_vat, v_line_net);
  END LOOP;

  UPDATE quotes SET total_net = round(v_net, 2), total_vat = round(v_net * v_vat / 100, 2),
                    total_gross = round(v_net, 2) + round(v_net * v_vat / 100, 2)
  WHERE id = v_quote;

  RETURN json_build_object('quote_number', v_qnum, 'total_net', round(v_net, 2),
                           'total_gross', round(v_net, 2) + round(v_net * v_vat / 100, 2));
END;
$$;
