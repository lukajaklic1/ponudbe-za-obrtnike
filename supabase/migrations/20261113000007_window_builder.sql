-- ============================================================
-- 20261113000007_window_builder.sql
-- Windows built from sashes (1–4, top light / bottom panel, opening per field), priced
-- from profile metres, glass, hardware, labour and margin — same formula as src/lib/costing.ts.
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

  -- a passive sash meets its neighbour without a mullion
  FOR i IN 1 .. n - 1 LOOP
    IF COALESCE(sp_main->(i - 1)->>'opening', '') NOT IN ('passive', 'slide_window', 'slide') AND COALESCE(sp_main->i->>'opening', '') NOT IN ('passive', 'slide_window', 'slide') THEN nm := nm + 1; END IF;
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

-- Configurator data: builder offer + sale prices (margin already folded in, so costs stay private)
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
    'builder', CASE WHEN COALESCE((c.window_pricing->'offer'->>'windows')::boolean, false) OR COALESCE((c.window_pricing->'offer'->>'slidingWindows')::boolean, false) THEN json_build_object(
      'offer', c.window_pricing->'offer',
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
GRANT EXECUTE ON FUNCTION get_configurator(text) TO anon, authenticated;

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
    SELECT * INTO v_sys FROM window_systems WHERE id = (v_item->>'system_id')::uuid AND company_id = c.id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_system'; END IF;
    v_spec := v_item->'spec';
    IF v_spec IS NULL THEN
      SELECT * INTO v_typ FROM window_types WHERE id = (v_item->>'type_id')::uuid AND company_id = c.id AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'invalid_type'; END IF;
      v_tname := v_typ.name;
    ELSE
      -- window built from sashes: only what the supplier offers
      v_n := COALESCE((v_spec->>'sashes')::integer, 0);
      IF v_n < 1 OR v_n > 4
         OR (v_spec->>'kind' = 'sliding' AND NOT COALESCE((c.window_pricing->'offer'->>'slidingWindows')::boolean, true))
         OR (COALESCE(v_spec->>'kind', '') <> 'sliding' AND NOT COALESCE((c.window_pricing->'offer'->>'windows')::boolean, false)) THEN RAISE EXCEPTION 'invalid_type'; END IF;
      v_typ := NULL;
      v_tname := CASE WHEN v_spec->>'kind' = 'sliding' THEN 'Drsno okno' WHEN v_n = 1 THEN 'Enokrilno okno' WHEN v_n = 2 THEN 'Dvokrilno okno' WHEN v_n = 3 THEN 'Trokrilno okno' ELSE 'Štirikrilno okno' END
        || CASE WHEN v_spec->>'top' IN ('single','split') THEN ' z nadsvetlobo' ELSE '' END
        || CASE WHEN v_spec->>'bottom' IN ('single','split') THEN ' s parapetom' ELSE '' END;
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
    v_base := CASE WHEN v_spec IS NULL THEN COALESCE(window_base_price(v_sys.id, v_typ.id, v_w, v_h), 0)
                   ELSE GREATEST(COALESCE(v_sys.min_price, 0), window_spec_price(v_sys, c.window_pricing, v_spec, v_w, v_h)) END;
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
            v_sys.name || CASE WHEN array_length(v_opt_names, 1) > 0 THEN ' · ' || array_to_string(v_opt_names, ', ') ELSE '' END,
            'pcs', v_qty, v_unit, 0, v_vat, v_line_net,
            jsonb_build_object('system_id', v_sys.id, 'type_id', v_typ.id, 'template', COALESCE(v_typ.template, 'spec'), 'spec', v_spec,
                               'width', v_w, 'height', v_h, 'hinge', v_hinge, 'option_ids', to_jsonb(v_opt_ids),
                               -- frozen copy: the line keeps looking the same after the price list changes
                               'type_name', v_tname, 'system_name', v_sys.name, 'material', v_sys.material,
                               'image_url', v_sys.image_url, 'color', v_color, 'options', v_opts));
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
GRANT EXECUTE ON FUNCTION submit_configuration(text, jsonb, jsonb, text, jsonb) TO anon, authenticated;




NOTIFY pgrst, 'reload schema';
