-- ============================================================
-- 20261120000002_install_address_area.sql
-- Configurator: installation address in parts (street + house number, postal code, town, country),
-- saved on the customer and as the site address of the quote; the supplier's installation area
-- (countries, and for Slovenia optionally only some postal areas) is sent to the configurator.
-- Re-runnable. Run after 20261120000001.
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS configurator_area jsonb NOT NULL DEFAULT '{"countries":["SI"],"si_areas":[]}'::jsonb;

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
      'currency', c.currency, 'accent', c.configurator_accent, 'intro', c.configurator_intro, 'area', c.configurator_area,
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
        'glass_rebate_mm', COALESCE((c.window_pricing->>'glass_rebate_mm')::numeric, 13),
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
  v_person     text := trim(trim(COALESCE(p_customer->>'first_name', '')) || ' ' || trim(COALESCE(p_customer->>'last_name', '')));
  v_ctype      text := CASE WHEN p_customer->>'customer_type' = 'company' THEN 'company' ELSE 'person' END;
  v_cname_in   text := trim(COALESCE(p_customer->>'company_name', ''));
  v_vatno      text := NULLIF(trim(COALESCE(p_customer->>'vat_number', '')), '');
  v_installing boolean;
  -- installation address: street + house number, postal code, town, country (code)
  v_street     text := NULLIF(trim(COALESCE(p_customer->>'street', '')), '');
  v_postal     text := NULLIF(trim(COALESCE(p_customer->>'postal_code', '')), '');
  v_city       text := NULLIF(trim(COALESCE(p_customer->>'city', '')), '');
  v_ccode      text := upper(NULLIF(trim(COALESCE(p_customer->>'country', '')), ''));
  v_country    text;
  v_site       text;
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
  v_sill_in    jsonb;
  v_sill_out   jsonb;
  v_shade      jsonb;
  v_screen     jsonb;
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
  -- chosen sills (inside + outside), shadings and insect screens, for services counted per chosen piece
  v_sum_sills   numeric := 0;
  v_sum_shades  numeric := 0;
  v_sum_screens numeric := 0;
  -- roof windows are counted apart: window work (installation, removal, finishing) does not apply to them
  v_roof_pcs    numeric := 0;
  v_roof_area   numeric := 0;
  v_roof_perim  numeric := 0;
  v_roof_width  numeric := 0;
  v_s_pcs       numeric;
  v_s_area      numeric;
  v_s_perim     numeric;
  v_s_width     numeric;
  v_svc_qty    numeric;
  v_svc_unit   text;
  v_svc_price  numeric;
BEGIN
  SELECT * INTO c FROM companies WHERE configurator_slug = lower(p_slug) AND configurator_enabled = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'configurator_not_found'; END IF;

  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF v_first = '' AND v_last = '' THEN RAISE EXCEPTION 'name_required'; END IF;
  IF v_ctype = 'company' AND v_cname_in = '' THEN RAISE EXCEPTION 'company_required'; END IF;
  IF v_street IS NULL OR v_postal IS NULL OR v_city IS NULL THEN RAISE EXCEPTION 'address_required'; END IF;
  v_country := CASE v_ccode WHEN 'SI' THEN 'Slovenija' WHEN 'HR' THEN 'Hrvaška' WHEN 'AT' THEN 'Avstrija' WHEN 'IT' THEN 'Italija'
                            WHEN 'HU' THEN 'Madžarska' WHEN 'DE' THEN 'Nemčija' ELSE v_ccode END;
  v_site := concat_ws(', ', v_street, concat_ws(' ', v_postal, v_city), CASE WHEN v_ccode <> 'SI' THEN v_country END);
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
    -- a company: the company is the customer, the person who filled in the form is its contact
    INSERT INTO customers (company_id, name, customer_type, first_name, last_name, contact_person, vat_number, email, phone, address, notes,
                           address_street, address_postal_code, address_city, country)
    VALUES (c.id, CASE WHEN v_ctype = 'company' THEN v_cname_in ELSE v_person END, v_ctype,
            CASE WHEN v_ctype = 'person' THEN NULLIF(v_first, '') END, CASE WHEN v_ctype = 'person' THEN NULLIF(v_last, '') END,
            CASE WHEN v_ctype = 'company' THEN NULLIF(v_person, '') END, CASE WHEN v_ctype = 'company' THEN v_vatno END,
            v_email, NULLIF(trim(COALESCE(p_customer->>'phone', '')), ''), v_site,
            'Spletni konfigurator', v_street, v_postal, v_city, v_country)
    RETURNING id INTO v_customer;
  ELSE
    -- a customer we already know by e-mail: keep what is there, fill in what is missing
    UPDATE customers SET
      first_name     = COALESCE(first_name, CASE WHEN customer_type = 'person' THEN NULLIF(v_first, '') END),
      last_name      = COALESCE(last_name, CASE WHEN customer_type = 'person' THEN NULLIF(v_last, '') END),
      contact_person = COALESCE(contact_person, CASE WHEN customer_type = 'company' THEN NULLIF(v_person, '') END),
      vat_number     = COALESCE(vat_number, CASE WHEN customer_type = 'company' THEN v_vatno END),
      phone          = COALESCE(phone, NULLIF(trim(COALESCE(p_customer->>'phone', '')), '')),
      address        = COALESCE(address, v_site),
      address_street = COALESCE(address_street, v_street),
      address_postal_code = COALESCE(address_postal_code, v_postal),
      address_city   = COALESCE(address_city, v_city),
      country        = COALESCE(country, v_country)
    WHERE id = v_customer;
  END IF;

  UPDATE companies SET quote_counter = quote_counter + 1 WHERE id = c.id
  RETURNING quote_counter INTO v_number;
  v_qnum := COALESCE(NULLIF(c.quote_prefix, ''), 'P') || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_number::text, 4, '0');

  -- 9,5% for installed windows in a home (private person), otherwise 22%
  v_installing := EXISTS (SELECT 1 FROM window_options o WHERE o.company_id = c.id AND o.group_key = 'installation'
                          AND o.id IN (SELECT (x)::uuid FROM jsonb_array_elements_text(COALESCE(p_services, '[]')) x));
  v_vat := CASE WHEN NOT COALESCE(c.vat_payer, true) THEN 0
                WHEN v_installing AND (SELECT customer_type FROM customers WHERE id = v_customer) = 'person' THEN 9.5
                ELSE 22 END;

  INSERT INTO quotes (company_id, customer_id, quote_number, title, status, source, created_by, assignee_id,
                      site_address, notes, valid_until, payment_terms, contact_email, contact_phone, lead_source, contact_person)
  VALUES (c.id, v_customer, v_qnum, (SELECT name FROM customers WHERE id = v_customer), 'draft', 'configurator', v_owner, v_owner,
          v_site, NULLIF(trim(COALESCE(p_note, '')), ''),
          current_date + COALESCE(c.default_valid_days, 30), c.default_payment_terms,
          v_email, NULLIF(trim(COALESCE(p_customer->>'phone', '')), ''),
          -- where the customer heard of the supplier (one of the fixed keys, anything else is ignored)
          CASE WHEN p_customer->>'lead_source' IN ('google', 'facebook', 'instagram', 'referral', 'existing', 'fair', 'ad', 'other') THEN p_customer->>'lead_source' END,
          NULLIF(v_person, ''))
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
      v_roof_pcs   := v_roof_pcs + v_qty;
      v_roof_area  := v_roof_area + (v_w::numeric * v_h::numeric) / 1000000 * v_qty;
      v_roof_perim := v_roof_perim + 2 * (v_w + v_h) / 1000.0 * v_qty;
      v_roof_width := v_roof_width + v_w / 1000.0 * v_qty;
      v_sum_base   := v_sum_base + v_unit * v_qty;
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
    v_glass := NULL; v_handle := NULL; v_sill_in := NULL; v_sill_out := NULL; v_shade := NULL; v_screen := NULL;
    IF v_spec IS NOT NULL THEN
      SELECT g INTO v_glass FROM jsonb_array_elements(COALESCE(c.window_pricing->'glass', '[]'::jsonb)) g WHERE g->>'id' = v_item->>'glass' LIMIT 1;
      v_glass := COALESCE(v_glass, c.window_pricing->'glass'->0);
      SELECT x INTO v_handle FROM jsonb_array_elements(COALESCE(c.window_pricing->'handles', '[]'::jsonb)) x WHERE x->>'id' = v_item->>'handle' LIMIT 1;
      v_handle := COALESCE(v_handle, c.window_pricing->'handles'->0);
      -- window sills: only when chosen (none by default)
      SELECT x INTO v_sill_in FROM jsonb_array_elements(COALESCE(c.window_pricing->'sills', '[]'::jsonb)) x
        WHERE x->>'side' = 'inner' AND x->>'id' = v_item->'sills'->>'in' LIMIT 1;
      SELECT x INTO v_sill_out FROM jsonb_array_elements(COALESCE(c.window_pricing->'sills', '[]'::jsonb)) x
        WHERE x->>'side' = 'outer' AND x->>'id' = v_item->'sills'->>'out' LIMIT 1;
      -- shading and insect screen: only when chosen
      SELECT x INTO v_shade FROM jsonb_array_elements(COALESCE(c.window_pricing->'shading', '[]'::jsonb)) x
        WHERE x->>'kind' = 'shade' AND x->>'id' = v_item->'shading'->>'shade' LIMIT 1;
      SELECT x INTO v_screen FROM jsonb_array_elements(COALESCE(c.window_pricing->'shading', '[]'::jsonb)) x
        WHERE x->>'kind' = 'screen' AND x->>'id' = v_item->'shading'->>'screen' LIMIT 1;
      -- a screen built into the shading's box and guides: only its own parts count (no lowest price)
      IF v_shade IS NOT NULL AND v_screen IS NOT NULL
         AND COALESCE((v_shade->>'allows_screen')::boolean, false) AND COALESCE((v_screen->>'can_integrate')::boolean, false)
         AND v_screen ? 'integrated' THEN
        v_screen := v_screen || jsonb_build_object('unit', 'm2', 'min', 0,
          'fixed', COALESCE((v_screen->'integrated'->>'fixed')::numeric, 0), 'per_w', COALESCE((v_screen->'integrated'->>'per_w')::numeric, 0),
          'per_h', COALESCE((v_screen->'integrated'->>'per_h')::numeric, 0), 'cost', COALESCE((v_screen->'integrated'->>'cost')::numeric, 0),
          'name', (v_screen->>'name') || ' (vgrajen)');
      END IF;
    END IF;
    v_base := CASE WHEN v_spec IS NULL THEN COALESCE(window_base_price(v_sys.id, v_typ.id, v_w, v_h), 0)
                   ELSE GREATEST(COALESCE(v_sys.min_price, 0), window_spec_price(v_sys, c.window_pricing, v_spec, v_w, v_h, v_cpct,
                          (v_glass->>'cost_m2')::numeric, COALESCE((v_handle->>'cost')::numeric, 0),
                          COALESCE((v_sill_in->>'cost_m')::numeric, 0) + COALESCE((v_sill_out->>'cost_m')::numeric, 0),
                          (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (SELECT v_shade AS x UNION ALL SELECT v_screen) q WHERE x IS NOT NULL))) END;
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
    v_sum_sills   := v_sum_sills + ((v_sill_in IS NOT NULL)::int + (v_sill_out IS NOT NULL)::int) * v_qty;
    v_sum_shades  := v_sum_shades + (v_shade IS NOT NULL)::int * v_qty;
    v_sum_screens := v_sum_screens + (v_screen IS NOT NULL)::int * v_qty;

    INSERT INTO quote_lines (quote_id, company_id, position, room, name, description, unit, quantity, unit_price,
                             discount_pct, vat_rate, total_net, config)
    VALUES (v_quote, c.id, v_pos, NULLIF(trim(COALESCE(v_item->>'label', '')), ''),
            v_tname || ' ' || v_w || ' × ' || v_h || ' mm',
            v_sys.name || COALESCE(', ' || v_cname, '') || COALESCE(', ' || (v_glass->>'name'), '') || COALESCE(', ' || (v_handle->>'name'), '') || COALESCE(', notranja polica ' || (v_sill_in->>'name'), '') || COALESCE(', zunanja polica ' || (v_sill_out->>'name'), '') || COALESCE(', ' || (v_shade->>'name'), '') || COALESCE(', ' || (v_screen->>'name'), '') || CASE WHEN array_length(v_opt_names, 1) > 0 THEN ' · ' || array_to_string(v_opt_names, ', ') ELSE '' END,
            'pcs', v_qty, v_unit, 0, v_vat, v_line_net,
            jsonb_build_object('system_id', v_sys.id, 'type_id', v_typ.id, 'template', COALESCE(v_typ.template, 'spec'), 'spec', v_spec,
                               'width', v_w, 'height', v_h, 'hinge', v_hinge, 'option_ids', to_jsonb(v_opt_ids),
                               -- frozen copy: the line keeps looking the same after the price list changes
                               'type_name', v_tname, 'system_name', v_sys.name, 'material', v_sys.material,
                               'image_url', v_sys.image_url, 'color', COALESCE(v_color, CASE WHEN v_cout->>'look' ~* '^#[0-9a-f]{6}' THEN substr(v_cout->>'look', 1, 7) END), 'options', v_opts,
                               'colors', jsonb_build_object('out', v_cout->>'name', 'in', v_cin->>'name', 'out_look', v_cout->>'look', 'in_look', v_cin->>'look', 'pct', v_cpct),
                               'glass', CASE WHEN v_glass IS NOT NULL THEN jsonb_build_object('name', v_glass->>'name', 'ug', v_glass->'ug') END,
                               'handle', CASE WHEN v_handle IS NOT NULL THEN jsonb_build_object('name', v_handle->>'name', 'look', v_handle->>'look') END,
                               'sills', jsonb_build_object('in', v_sill_in->>'name', 'out', v_sill_out->>'name'),
                               'shading', jsonb_build_object('shade', v_shade->>'name', 'screen', v_screen->>'name')));
  END LOOP;

  -- ── services for the whole order (one line each, quantity summed over all windows) ──
  FOR v_opt IN
    SELECT o.* FROM window_options o
    WHERE o.company_id = c.id AND o.is_active
      AND (o.group_key IN ('installation','removal','finishing','transport') OR o.pricing = 'flat')
      AND (o.id IN (SELECT (x)::uuid FROM jsonb_array_elements_text(COALESCE(p_services, '[]')) x)
        -- work on chosen sills / shadings / insect screens comes automatically with any chosen installation
        -- (roof window work is picked by the customer, see p_services)
        OR (o.per_item NOT IN ('window', 'roof') AND EXISTS (
              SELECT 1 FROM window_options i
              WHERE i.company_id = c.id AND i.is_active AND i.group_key = 'installation'
                AND i.id IN (SELECT (x)::uuid FROM jsonb_array_elements_text(COALESCE(p_services, '[]')) x))))
    ORDER BY o.group_key, o.sort_order
  LOOP
    -- counted per chosen sill / shading / insect screen: only the pieces the customer picked, none = no line
    IF COALESCE(v_opt.per_item, 'window') <> 'window' THEN
      v_svc_qty := CASE v_opt.per_item WHEN 'sill' THEN v_sum_sills WHEN 'shade' THEN v_sum_shades WHEN 'roof' THEN v_roof_pcs ELSE v_sum_screens END;
      CONTINUE WHEN v_svc_qty = 0;
      v_pos := v_pos + 1;
      v_svc_price := round(COALESCE(v_opt.price_piece, 0), 2);
      v_line_net  := round(v_svc_qty * v_svc_price, 2);
      v_net := v_net + v_line_net;
      INSERT INTO quote_lines (quote_id, company_id, position, room, name, description, unit, quantity, unit_price,
                               discount_pct, vat_rate, total_net)
      VALUES (v_quote, c.id, v_pos, NULL, v_opt.name, v_opt.description, 'pcs', v_svc_qty, v_svc_price, 0, v_vat, v_line_net);
      CONTINUE;
    END IF;
    -- delivery and disposal count every window, roof windows too; work on windows counts only the windows
    IF v_opt.group_key = 'transport' THEN
      v_s_pcs := v_sum_pcs + v_roof_pcs; v_s_area := v_sum_area + v_roof_area; v_s_perim := v_sum_perim + v_roof_perim; v_s_width := v_sum_width + v_roof_width;
    ELSE
      v_s_pcs := v_sum_pcs; v_s_area := v_sum_area; v_s_perim := v_sum_perim; v_s_width := v_sum_width;
    END IF;
    -- nothing to work on (e.g. an order with roof windows only): no line
    CONTINUE WHEN v_s_pcs = 0 AND v_opt.pricing NOT IN ('flat', 'percent');
    v_pos := v_pos + 1;
    v_svc_price := v_opt.price;
    CASE v_opt.pricing
      WHEN 'piece'     THEN v_svc_qty := v_s_pcs;   v_svc_unit := 'pcs';
      WHEN 'm2'        THEN v_svc_qty := v_s_area;  v_svc_unit := 'm2';
      WHEN 'perimeter' THEN v_svc_qty := v_s_perim; v_svc_unit := 'm';
      WHEN 'width'     THEN v_svc_qty := v_s_width; v_svc_unit := 'm';
      WHEN 'percent'   THEN v_svc_qty := 1;           v_svc_unit := 'lump'; v_svc_price := v_sum_base * v_opt.price / 100;
      ELSE                  v_svc_qty := 1;           v_svc_unit := 'lump';
    END CASE;
    -- an amount per window on top (installation, removal): one line per window with the average price
    IF COALESCE(v_opt.price_piece, 0) <> 0 AND v_s_pcs > 0 THEN
      v_svc_price := v_opt.price_piece + v_svc_qty * v_svc_price / v_s_pcs;
      v_svc_qty   := v_s_pcs;
      v_svc_unit  := 'pcs';
    END IF;
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
