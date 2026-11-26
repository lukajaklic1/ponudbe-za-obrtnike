-- >>>>>> 20261119000001_sash_widths
-- ============================================================
-- 20261119000001_sash_widths.sql
-- Sashes of different widths: each main sash may carry a weight (its share of the width).
-- Glass and sash lengths follow the real width of each sash, same as the app. Re-runnable.
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
  -- the pane reaches this far into the rebate on every side (mm)
  reb     numeric := COALESCE((p->>'glass_rebate_mm')::numeric, 13);
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
    SELECT e AS f, (inner_w - nm * mw) * COALESCE(NULLIF((e->>'weight')::numeric, 0), 1)
           / (SELECT SUM(COALESCE(NULLIF((m->>'weight')::numeric, 0), 1)) FROM jsonb_array_elements(sp_main) m) AS cw, main_h AS ch FROM jsonb_array_elements(sp_main) e
    UNION ALL
    SELECT e, (inner_w - (nt - 1) * mw) / GREATEST(nt, 1), top_h - fw - mw / 2 FROM jsonb_array_elements(CASE WHEN nt > 0 THEN spec->'topFields' ELSE '[]'::jsonb END) e
    UNION ALL
    SELECT e, (inner_w - (nb - 1) * mw) / GREATEST(nb, 1), bot_h - fw - mw / 2 FROM jsonb_array_elements(CASE WHEN nb > 0 THEN spec->'bottomFields' ELSE '[]'::jsonb END) e
  LOOP
    IF r.cw <= 0 OR r.ch <= 0 THEN CONTINUE; END IF;
    op := COALESCE(r.f->>'opening', 'fixed');
    IF op = 'fixed' THEN
      bead  := bead + 2 * (r.cw + r.ch);
      glass := glass + GREATEST((r.cw + 2 * reb) * (r.ch + 2 * reb) / 1000000.0, gmin);
    ELSE
      sashes := sashes + 1;
      -- a passive sash is opened from the other one: no handle
      IF op IN ('tilt_turn', 'turn', 'tilt', 'slide_window', 'slide', 'lift_slide') THEN handles := handles + 1; END IF;
      sw2 := r.cw + 2 * ov; sh2 := r.ch + 2 * ov;
      s_w := s_w + sw2; s_h := s_h + sh2; s_a := s_a + sw2 * sh2 / 1000000.0;
      sash := sash + 2 * (sw2 + sh2);
      gw := GREATEST(0, sw2 - 2 * sw); gh := GREATEST(0, sh2 - 2 * sw);
      bead  := bead + 2 * (gw + gh);
      IF gw > 0 AND gh > 0 THEN glass := glass + GREATEST((gw + 2 * reb) * (gh + 2 * reb) / 1000000.0, gmin); END IF;
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

-- >>>>>> 20261119000002_lead_source
-- ============================================================
-- 20261119000002_lead_source.sql
-- Sales channel of a quote ("Kje ste izvedeli za nas?"): google, facebook, instagram, referral, existing, fair, ad, other.
-- The customer picks it in the configurator; in the app it is set on the quote. Used in the reports. Re-runnable.
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS lead_source text;

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
                      site_address, notes, valid_until, payment_terms, contact_email, contact_phone, lead_source)
  VALUES (c.id, v_customer, v_qnum, trim(v_first || ' ' || v_last), 'draft', 'configurator', v_owner, v_owner,
          NULLIF(trim(COALESCE(p_customer->>'address', '')), ''), NULLIF(trim(COALESCE(p_note, '')), ''),
          current_date + COALESCE(c.default_valid_days, 30), c.default_payment_terms,
          v_email, NULLIF(trim(COALESCE(p_customer->>'phone', '')), ''),
          -- where the customer heard of the supplier (one of the fixed keys, anything else is ignored)
          CASE WHEN p_customer->>'lead_source' IN ('google', 'facebook', 'instagram', 'referral', 'existing', 'fair', 'ad', 'other') THEN p_customer->>'lead_source' END)
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

-- >>>>>> 20261119000003_advance_discount
-- Price with 100% advance payment: a default discount in the company settings,
-- copied to each quote where it can be changed. The quote and the PDF show both prices.
alter table public.companies add column if not exists advance_discount_pct numeric not null default 3;
alter table public.quotes add column if not exists advance_discount_pct numeric;

-- >>>>>> 20261120000001_configurator_customer_vat
-- ============================================================
-- 20261120000001_configurator_customer_vat.sql
-- Configurator enquiry: the customer says whether they are a private person or a company
-- (company name and VAT number), the quote gets the contact person, an existing customer
-- (same e-mail) gets missing details filled in, and VAT is 9,5% when the windows are installed
-- for a private person (home renovation), otherwise 22% (0 for a supplier outside the VAT system).
-- Re-runnable.
-- ============================================================

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
    INSERT INTO customers (company_id, name, customer_type, first_name, last_name, contact_person, vat_number, email, phone, address, notes)
    VALUES (c.id, CASE WHEN v_ctype = 'company' THEN v_cname_in ELSE v_person END, v_ctype,
            CASE WHEN v_ctype = 'person' THEN NULLIF(v_first, '') END, CASE WHEN v_ctype = 'person' THEN NULLIF(v_last, '') END,
            CASE WHEN v_ctype = 'company' THEN NULLIF(v_person, '') END, CASE WHEN v_ctype = 'company' THEN v_vatno END,
            v_email, NULLIF(trim(COALESCE(p_customer->>'phone', '')), ''), NULLIF(trim(COALESCE(p_customer->>'address', '')), ''),
            'Spletni konfigurator')
    RETURNING id INTO v_customer;
  ELSE
    -- a customer we already know by e-mail: keep what is there, fill in what is missing
    UPDATE customers SET
      first_name     = COALESCE(first_name, CASE WHEN customer_type = 'person' THEN NULLIF(v_first, '') END),
      last_name      = COALESCE(last_name, CASE WHEN customer_type = 'person' THEN NULLIF(v_last, '') END),
      contact_person = COALESCE(contact_person, CASE WHEN customer_type = 'company' THEN NULLIF(v_person, '') END),
      vat_number     = COALESCE(vat_number, CASE WHEN customer_type = 'company' THEN v_vatno END),
      phone          = COALESCE(phone, NULLIF(trim(COALESCE(p_customer->>'phone', '')), '')),
      address        = COALESCE(address, NULLIF(trim(COALESCE(p_customer->>'address', '')), ''))
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
          NULLIF(trim(COALESCE(p_customer->>'address', '')), ''), NULLIF(trim(COALESCE(p_note, '')), ''),
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

-- >>>>>> 20261120000002_install_address_area
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

-- >>>>>> 20261120000003_min_price_window_only
-- ============================================================
-- 20261120000003_min_price_window_only.sql
-- The profile's lowest price applies to the window alone (standard glass and handle).
-- Better glass, a dearer handle, sills, shading and insect screens are added on top of it,
-- the same as in the configurator. Re-runnable. Run after 20261120000002.
-- ============================================================

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
  v_win        numeric;   -- the window alone (standard glass and handle): the profile's lowest price applies to it
  v_full       numeric;   -- the window with everything chosen
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
    IF v_spec IS NULL THEN
      v_base := COALESCE(window_base_price(v_sys.id, v_typ.id, v_w, v_h), 0);
    ELSE
      v_full := window_spec_price(v_sys, c.window_pricing, v_spec, v_w, v_h, v_cpct,
                  (v_glass->>'cost_m2')::numeric, COALESCE((v_handle->>'cost')::numeric, 0),
                  COALESCE((v_sill_in->>'cost_m')::numeric, 0) + COALESCE((v_sill_out->>'cost_m')::numeric, 0),
                  (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (SELECT v_shade AS x UNION ALL SELECT v_screen) q WHERE x IS NOT NULL));
      -- the same window with the first (standard) glass and handle, without sills, shading and screens
      v_win := window_spec_price(v_sys, c.window_pricing, v_spec, v_w, v_h, v_cpct,
                  COALESCE((c.window_pricing->'glass'->0->>'cost_m2')::numeric, (v_glass->>'cost_m2')::numeric),
                  COALESCE((c.window_pricing->'handles'->0->>'cost')::numeric, (v_handle->>'cost')::numeric, 0),
                  0, '[]'::jsonb);
      -- lowest price only for the window; the extras come on top of it
      v_base := GREATEST(COALESCE(v_sys.min_price, 0), v_win) + (v_full - v_win);
    END IF;
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

-- >>>>>> 20261120000004_quote_viewed_at
-- New enquiries from the online configurator: a quote counts as new until someone opens it in the app.
-- viewed_at is set the first time a user opens the quote. Re-runnable.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

-- quotes made in the app are seen by the person who made them
UPDATE quotes SET viewed_at = COALESCE(viewed_at, created_at) WHERE COALESCE(source, 'manual') <> 'configurator';

-- >>>>>> 20261120000005_shade_color
-- ============================================================
-- 20261120000005_shade_color.sql
-- Configurator: the customer picks the colour of the shading and its box (same as the frame,
-- white, silver, anthracite, brown; no extra charge). It goes into the window's description and config.
-- Re-runnable. Run after 20261120000003.
-- ============================================================

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
  v_shcol      text;      -- colour of the shading and its box, in words
  v_win        numeric;   -- the window alone (standard glass and handle): the profile's lowest price applies to it
  v_full       numeric;   -- the window with everything chosen
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
    v_glass := NULL; v_handle := NULL; v_sill_in := NULL; v_sill_out := NULL; v_shade := NULL; v_screen := NULL; v_shcol := NULL;
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
      v_shcol := CASE WHEN v_shade IS NULL THEN NULL ELSE CASE v_item->'shading'->>'color'
                   WHEN 'white' THEN 'bela' WHEN 'silver' THEN 'srebrna' WHEN 'anthracite' THEN 'antracit' WHEN 'brown' THEN 'rjava'
                   ELSE 'enaka kot okvir' END END;
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
    IF v_spec IS NULL THEN
      v_base := COALESCE(window_base_price(v_sys.id, v_typ.id, v_w, v_h), 0);
    ELSE
      v_full := window_spec_price(v_sys, c.window_pricing, v_spec, v_w, v_h, v_cpct,
                  (v_glass->>'cost_m2')::numeric, COALESCE((v_handle->>'cost')::numeric, 0),
                  COALESCE((v_sill_in->>'cost_m')::numeric, 0) + COALESCE((v_sill_out->>'cost_m')::numeric, 0),
                  (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (SELECT v_shade AS x UNION ALL SELECT v_screen) q WHERE x IS NOT NULL));
      -- the same window with the first (standard) glass and handle, without sills, shading and screens
      v_win := window_spec_price(v_sys, c.window_pricing, v_spec, v_w, v_h, v_cpct,
                  COALESCE((c.window_pricing->'glass'->0->>'cost_m2')::numeric, (v_glass->>'cost_m2')::numeric),
                  COALESCE((c.window_pricing->'handles'->0->>'cost')::numeric, (v_handle->>'cost')::numeric, 0),
                  0, '[]'::jsonb);
      -- lowest price only for the window; the extras come on top of it
      v_base := GREATEST(COALESCE(v_sys.min_price, 0), v_win) + (v_full - v_win);
    END IF;
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
            v_sys.name || COALESCE(', ' || v_cname, '') || COALESCE(', ' || (v_glass->>'name'), '') || COALESCE(', ' || (v_handle->>'name'), '') || COALESCE(', notranja polica ' || (v_sill_in->>'name'), '') || COALESCE(', zunanja polica ' || (v_sill_out->>'name'), '') || COALESCE(', ' || (v_shade->>'name') || COALESCE(' (barva ' || v_shcol || ')', ''), '') || COALESCE(', ' || (v_screen->>'name'), '') || CASE WHEN array_length(v_opt_names, 1) > 0 THEN ' · ' || array_to_string(v_opt_names, ', ') ELSE '' END,
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
                               'shading', jsonb_build_object('shade', v_shade->>'name', 'screen', v_screen->>'name', 'color', v_shcol)));
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

-- >>>>>> 20261120000006_configurator_modes
-- ============================================================
-- 20261120000006_configurator_modes.sql
-- How the public configurator works, chosen by the supplier on the Objava page:
--   price_mode: live (prices while configuring) | end (only at the end) | range (from–to) | never
--   end_mode:   enquiry (send an enquiry) | pdf (download the informative offer, the enquiry is sent too) | choose (the customer picks)
-- The configurator gets both; submitting returns the supplier's details for the offer PDF.
-- Re-runnable. Run after 20261120000005.
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS configurator_price_mode text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS configurator_end_mode text NOT NULL DEFAULT 'enquiry';
-- size of the supplier's logo in the configurator's top bar: s / m / l
ALTER TABLE companies ADD COLUMN IF NOT EXISTS configurator_logo_size text NOT NULL DEFAULT 'm';
UPDATE companies SET configurator_price_mode = CASE WHEN configurator_show_prices THEN 'live' ELSE 'never' END WHERE configurator_price_mode IS NULL;
ALTER TABLE companies ALTER COLUMN configurator_price_mode SET DEFAULT 'live';
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_configurator_price_mode_check;
ALTER TABLE companies ADD CONSTRAINT companies_configurator_price_mode_check CHECK (configurator_price_mode IN ('live', 'end', 'range', 'never'));
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_configurator_end_mode_check;
ALTER TABLE companies ADD CONSTRAINT companies_configurator_end_mode_check CHECK (configurator_end_mode IN ('enquiry', 'pdf', 'choose'));

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
      'price_mode', COALESCE(c.configurator_price_mode, CASE WHEN c.configurator_show_prices THEN 'live' ELSE 'never' END),
      'end_mode', COALESCE(c.configurator_end_mode, 'enquiry'),
      'logo_size', COALESCE(c.configurator_logo_size, 'm'),
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
  v_shcol      text;      -- colour of the shading and its box, in words
  v_win        numeric;   -- the window alone (standard glass and handle): the profile's lowest price applies to it
  v_full       numeric;   -- the window with everything chosen
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
    v_glass := NULL; v_handle := NULL; v_sill_in := NULL; v_sill_out := NULL; v_shade := NULL; v_screen := NULL; v_shcol := NULL;
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
      v_shcol := CASE WHEN v_shade IS NULL THEN NULL ELSE CASE v_item->'shading'->>'color'
                   WHEN 'white' THEN 'bela' WHEN 'silver' THEN 'srebrna' WHEN 'anthracite' THEN 'antracit' WHEN 'brown' THEN 'rjava'
                   ELSE 'enaka kot okvir' END END;
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
    IF v_spec IS NULL THEN
      v_base := COALESCE(window_base_price(v_sys.id, v_typ.id, v_w, v_h), 0);
    ELSE
      v_full := window_spec_price(v_sys, c.window_pricing, v_spec, v_w, v_h, v_cpct,
                  (v_glass->>'cost_m2')::numeric, COALESCE((v_handle->>'cost')::numeric, 0),
                  COALESCE((v_sill_in->>'cost_m')::numeric, 0) + COALESCE((v_sill_out->>'cost_m')::numeric, 0),
                  (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (SELECT v_shade AS x UNION ALL SELECT v_screen) q WHERE x IS NOT NULL));
      -- the same window with the first (standard) glass and handle, without sills, shading and screens
      v_win := window_spec_price(v_sys, c.window_pricing, v_spec, v_w, v_h, v_cpct,
                  COALESCE((c.window_pricing->'glass'->0->>'cost_m2')::numeric, (v_glass->>'cost_m2')::numeric),
                  COALESCE((c.window_pricing->'handles'->0->>'cost')::numeric, (v_handle->>'cost')::numeric, 0),
                  0, '[]'::jsonb);
      -- lowest price only for the window; the extras come on top of it
      v_base := GREATEST(COALESCE(v_sys.min_price, 0), v_win) + (v_full - v_win);
    END IF;
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
            v_sys.name || COALESCE(', ' || v_cname, '') || COALESCE(', ' || (v_glass->>'name'), '') || COALESCE(', ' || (v_handle->>'name'), '') || COALESCE(', notranja polica ' || (v_sill_in->>'name'), '') || COALESCE(', zunanja polica ' || (v_sill_out->>'name'), '') || COALESCE(', ' || (v_shade->>'name') || COALESCE(' (barva ' || v_shcol || ')', ''), '') || COALESCE(', ' || (v_screen->>'name'), '') || CASE WHEN array_length(v_opt_names, 1) > 0 THEN ' · ' || array_to_string(v_opt_names, ', ') ELSE '' END,
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
                               'shading', jsonb_build_object('shade', v_shade->>'name', 'screen', v_screen->>'name', 'color', v_shcol)));
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
                           'total_gross', round(v_net, 2) + round(v_net * v_vat / 100, 2),
                           'valid_until', current_date + COALESCE(c.default_valid_days, 30),
                           -- the supplier's details for the informative offer the customer can download
                           'company', json_build_object(
                             'name', c.name, 'address_street', c.address_street, 'address_postal_code', c.address_postal_code,
                             'address_city', c.address_city, 'address_country', c.address_country, 'tax_id', c.tax_id,
                             'legal_form', c.legal_form, 'registration_number', c.registration_number, 'registry_authority', c.registry_authority,
                             'share_capital', c.share_capital, 'unpaid_capital', c.unpaid_capital, 'email', c.email, 'phone', c.phone,
                             'bank_name', c.bank_name, 'bank_iban', c.bank_iban, 'bank_bic', c.bank_bic, 'logo_url', c.logo_url,
                             'quote_terms', c.quote_terms, 'quote_terms_en', c.quote_terms_en, 'website', c.website, 'currency', c.currency,
                             'vat_payer', c.vat_payer, 'vat_exempt_note', c.vat_exempt_note, 'default_payment_terms', c.default_payment_terms,
                             'advance_discount_pct', c.advance_discount_pct));
END;
$$;

-- >>>>>> 20261120000007_labour_fields_bars
-- ============================================================
-- 20261120000007_labour_fields_bars.sql
-- A window's price: labour per fixed field (top light, bottom panel, fixed glass) and per transom / mullion bar,
-- so a top light or a bottom panel never makes a window cheaper (shorter sashes, but more work).
-- Defaults 12 € and 8 €, set in Konfigurator → Delo. Same as the app. Re-runnable.
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
  -- the pane reaches this far into the rebate on every side (mm)
  reb     numeric := COALESCE((p->>'glass_rebate_mm')::numeric, 13);
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
  -- fixed fields and transom / mullion bars: labour of their own
  fixeds  integer := 0;
  bars    integer := 0;
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
  bars := nm + (CASE WHEN nt > 0 THEN nt ELSE 0 END) + (CASE WHEN nb > 0 THEN nb ELSE 0 END);
  IF nt > 0 THEN mull := mull + inner_w + (nt - 1) * GREATEST(0, top_h - fw - mw / 2); END IF;
  IF nb > 0 THEN mull := mull + inner_w + (nb - 1) * GREATEST(0, bot_h - fw - mw / 2); END IF;

  FOR r IN
    SELECT e AS f, (inner_w - nm * mw) * COALESCE(NULLIF((e->>'weight')::numeric, 0), 1)
           / (SELECT SUM(COALESCE(NULLIF((m->>'weight')::numeric, 0), 1)) FROM jsonb_array_elements(sp_main) m) AS cw, main_h AS ch FROM jsonb_array_elements(sp_main) e
    UNION ALL
    SELECT e, (inner_w - (nt - 1) * mw) / GREATEST(nt, 1), top_h - fw - mw / 2 FROM jsonb_array_elements(CASE WHEN nt > 0 THEN spec->'topFields' ELSE '[]'::jsonb END) e
    UNION ALL
    SELECT e, (inner_w - (nb - 1) * mw) / GREATEST(nb, 1), bot_h - fw - mw / 2 FROM jsonb_array_elements(CASE WHEN nb > 0 THEN spec->'bottomFields' ELSE '[]'::jsonb END) e
  LOOP
    IF r.cw <= 0 OR r.ch <= 0 THEN CONTINUE; END IF;
    op := COALESCE(r.f->>'opening', 'fixed');
    IF op = 'fixed' THEN
      fixeds := fixeds + 1;
      bead  := bead + 2 * (r.cw + r.ch);
      glass := glass + GREATEST((r.cw + 2 * reb) * (r.ch + 2 * reb) / 1000000.0, gmin);
    ELSE
      sashes := sashes + 1;
      -- a passive sash is opened from the other one: no handle
      IF op IN ('tilt_turn', 'turn', 'tilt', 'slide_window', 'slide', 'lift_slide') THEN handles := handles + 1; END IF;
      sw2 := r.cw + 2 * ov; sh2 := r.ch + 2 * ov;
      s_w := s_w + sw2; s_h := s_h + sh2; s_a := s_a + sw2 * sh2 / 1000000.0;
      sash := sash + 2 * (sw2 + sh2);
      gw := GREATEST(0, sw2 - 2 * sw); gh := GREATEST(0, sh2 - 2 * sw);
      bead  := bead + 2 * (gw + gh);
      IF gw > 0 AND gh > 0 THEN glass := glass + GREATEST((gw + 2 * reb) * (gh + 2 * reb) / 1000000.0, gmin); END IF;
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
                + COALESCE((p->>'labour_sash_m')::numeric, 0) * sash / 1000.0
                + fixeds * COALESCE((p->>'labour_field')::numeric, 12) + bars * COALESCE((p->>'labour_bar')::numeric, 8))
               * (1 + COALESCE((p->>'labour_margin_pct')::numeric, (p->>'margin_pct')::numeric, 45) / 100), 2);
END;
$$;


-- the configurator (public and in a quote) gets the same two amounts, with the labour margin, like the other labour
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
      'price_mode', COALESCE(c.configurator_price_mode, CASE WHEN c.configurator_show_prices THEN 'live' ELSE 'never' END),
      'end_mode', COALESCE(c.configurator_end_mode, 'enquiry'),
      'logo_size', COALESCE(c.configurator_logo_size, 'm'),
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
        'labour_field', (COALESCE((c.window_pricing->>'labour_field')::numeric, 12) * lmf),
        'labour_bar', (COALESCE((c.window_pricing->>'labour_bar')::numeric, 8) * lmf),
        'waste_pct', COALESCE((c.window_pricing->>'waste_pct')::numeric, 6),
        'margin_pct', 0, 'labour_margin_pct', 0,
        'both_sides_pct', COALESCE((c.window_pricing->>'both_sides_pct')::numeric, 10)) END) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_configurator_internal()
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
  -- the signed-in user's own company, whether or not the public configurator is switched on; prices always shown
  SELECT * INTO c FROM companies WHERE id = get_my_company_id();
  IF NOT FOUND THEN RETURN NULL; END IF;
  c.configurator_show_prices := true;
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
        'glass_rebate_mm', COALESCE((c.window_pricing->>'glass_rebate_mm')::numeric, 13),
        'labour_window', (COALESCE((c.window_pricing->>'labour_window')::numeric, 30) * lmf),
        'labour_sash', (COALESCE((c.window_pricing->>'labour_sash')::numeric, 22) * lmf),
        'labour_frame_m', (COALESCE((c.window_pricing->>'labour_frame_m')::numeric, 0) * lmf),
        'labour_sash_m', (COALESCE((c.window_pricing->>'labour_sash_m')::numeric, 0) * lmf),
        'labour_field', (COALESCE((c.window_pricing->>'labour_field')::numeric, 12) * lmf),
        'labour_bar', (COALESCE((c.window_pricing->>'labour_bar')::numeric, 8) * lmf),
        'waste_pct', COALESCE((c.window_pricing->>'waste_pct')::numeric, 6),
        'margin_pct', 0, 'labour_margin_pct', 0,
        'both_sides_pct', COALESCE((c.window_pricing->>'both_sides_pct')::numeric, 10)) END) END
  );
END;
$$;

-- >>>>>> 20261123000001_shade_colors
-- ============================================================
-- 20261123000001_shade_colors.sql
-- Configurator: the supplier sets the colours of the shading (window_pricing.shade_colors, a list of
-- { id, name, name_en?, hex }). Without a list the configurator offers its default colours.
--   * get_configurator() and get_configurator_internal() return the list as builder.shade_colors
--   * submit_configuration() writes the colour NAME of the customer's choice into the window description
--     (the supplier's own list first, then the built-in colours)
-- The three functions are patched in place (their current definition is read, one piece of text is
-- added, the function is created again), so nothing else in them changes. Re-runnable: a function
-- that already has the change is left alone.
-- Run after 20261120000007. Do NOT use `supabase db push` from this folder (the CLI link points to another project):
-- paste the file into the SQL editor of the Fenestio project.
-- ============================================================

DO $patch$
DECLARE
  d text;
BEGIN
  -- 1. the list goes to the configurator
  FOREACH d IN ARRAY ARRAY['get_configurator(text)', 'get_configurator_internal()'] LOOP
    DECLARE
      def text := pg_get_functiondef(d::regprocedure);
      anchor text := E'      ''shading'', (SELECT COALESCE(jsonb_agg(';
    BEGIN
      IF position('shade_colors' IN def) = 0 THEN
        IF position(anchor IN def) = 0 THEN RAISE EXCEPTION 'anchor not found in %', d; END IF;
        def := replace(def, anchor, E'      ''shade_colors'', COALESCE(c.window_pricing->''shade_colors'', ''[]''::jsonb),\n' || anchor);
        EXECUTE def;
      END IF;
    END;
  END LOOP;

  -- 2. the colour name of the customer's choice
  DECLARE
    def text := pg_get_functiondef('submit_configuration(text,jsonb,jsonb,text,jsonb)'::regprocedure);
    anchor text := E'ELSE ''enaka kot okvir'' END END;';
  BEGIN
    IF position('shade_colors' IN def) = 0 THEN
      IF position(anchor IN def) = 0 THEN RAISE EXCEPTION 'anchor not found in submit_configuration'; END IF;
      def := replace(def, anchor,
        E'WHEN ''cream'' THEN ''krem'' WHEN ''grey'' THEN ''siva'' WHEN ''black'' THEN ''črna'' WHEN ''light_grey'' THEN ''svetlo siva'' WHEN ''beige'' THEN ''bež'' WHEN ''dark_brown'' THEN ''temno rjava''\n'
        || E'                   ELSE ''enaka kot okvir'' END END;\n'
        || E'      -- the supplier''s own colour list has the last word on the name\n'
        || E'      IF v_shade IS NOT NULL THEN\n'
        || E'        v_shcol := COALESCE((SELECT x->>''name'' FROM jsonb_array_elements(COALESCE(c.window_pricing->''shade_colors'', ''[]''::jsonb)) x\n'
        || E'                             WHERE x->>''id'' = v_item->''shading''->>''color'' LIMIT 1), v_shcol);\n'
        || E'      END IF;');
      EXECUTE def;
    END IF;
  END;
END
$patch$;

-- >>>>>> 20261123000002_quote_statuses
-- ============================================================
-- 20261123000002_quote_statuses.sql
-- Two new quote statuses for what the customer does in the configurator:
--   enquiry     the customer sent an enquiry; the supplier still has to make and send the offer
--   downloaded  the customer took the offer straight away ("Ponudba prenesena"): the offer is with the customer
-- submit_configuration() sets the status: the page sends p_customer.outcome = 'offer' when the customer
-- downloaded the offer; the server only believes it when the supplier's configurator allows offers
-- (end mode pdf or choose). Everything else is an enquiry.
-- Old configurator enquiries (still "draft") become enquiries. Reports that count sent quotes count downloaded ones too.
-- Re-runnable. Run after 20261123000001. Do NOT use `supabase db push` from this folder: paste it into the SQL editor of the Fenestio project.
-- ============================================================

-- 1. the statuses
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('enquiry','draft','issued','sent','downloaded','accepted','rejected','expired','won','lost','frozen'));

-- 2. what the configurator creates
DO $patch$
DECLARE
  def text := pg_get_functiondef('submit_configuration(text,jsonb,jsonb,text,jsonb)'::regprocedure);
  anchor text := E'(SELECT name FROM customers WHERE id = v_customer), ''draft'', ''configurator'', v_owner, v_owner,';
BEGIN
  IF position('''downloaded''' IN def) = 0 THEN
    IF position(anchor IN def) = 0 THEN RAISE EXCEPTION 'anchor not found in submit_configuration'; END IF;
    def := replace(def, anchor,
      E'(SELECT name FROM customers WHERE id = v_customer),\n'
      || E'          CASE WHEN p_customer->>''outcome'' = ''offer'' AND COALESCE(c.configurator_end_mode, ''enquiry'') IN (''pdf'', ''choose'') THEN ''downloaded'' ELSE ''enquiry'' END,\n'
      || E'          ''configurator'', v_owner, v_owner,');
    EXECUTE def;
  END IF;
END
$patch$;

-- 3. enquiries that came in before this change
UPDATE quotes SET status = 'enquiry' WHERE source = 'configurator' AND status = 'draft';

-- 4. reports that count sent quotes: a downloaded offer is a sent offer
DO $patch$
DECLARE
  r record;
  def text;
  newdef text;
BEGIN
  FOR r IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname LIKE 'get\_%' AND p.prosrc ILIKE '%quotes%' AND p.prosrc LIKE '%''sent''%'
  LOOP
    def := pg_get_functiondef(r.oid);
    newdef := def;
    IF position('''downloaded''' IN def) = 0 THEN
      newdef := replace(newdef, '''sent'',''won'',''lost''', '''sent'',''downloaded'',''won'',''lost''');
      newdef := replace(newdef, '''sent'', ''won'', ''lost''', '''sent'', ''downloaded'', ''won'', ''lost''');
      newdef := replace(newdef, 'status = ''sent''', 'status IN (''sent'', ''downloaded'')');
      IF newdef <> def THEN
        EXECUTE newdef;
        RAISE NOTICE 'counts downloaded offers as sent: %', r.proname;
      END IF;
    END IF;
  END LOOP;
END
$patch$;

-- >>>>>> 20261124000001_configurator_theme
-- Configurator look per supplier: companies.configurator_theme holds only the values the supplier changed
-- (font, bg, button, ink, muted, border); null = the default look. get_configurator() returns it as company.theme
-- (the internal configurator inside the quote editor keeps the app's own look). Safe to run twice.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS configurator_theme jsonb;

DO $patch$
DECLARE
  def text := pg_get_functiondef('get_configurator(text)'::regprocedure);
  anchor text := E'      ''logo_size'', COALESCE(c.configurator_logo_size, ''m''),';
BEGIN
  IF position('configurator_theme' IN def) = 0 THEN
    IF position(anchor IN def) = 0 THEN RAISE EXCEPTION 'anchor not found in get_configurator'; END IF;
    def := replace(def, anchor, anchor || E'\n      ''theme'', c.configurator_theme,');
    EXECUTE def;
  END IF;
END
$patch$;

SELECT (SELECT count(*) FROM information_schema.columns WHERE table_name='companies' AND column_name IN ('configurator_area','configurator_end_mode','configurator_price_mode','configurator_logo_size','configurator_theme')) AS company_columns_5, get_configurator(configurator_slug) IS NOT NULL AS dela FROM companies WHERE configurator_enabled LIMIT 1;
