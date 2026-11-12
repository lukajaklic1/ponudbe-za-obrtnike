-- ============================================================
-- 20261112000001_window_cpq.sql
-- Window CPQ: catalog + price matrices + public configurator.
--  * window_systems  — profile systems (PVC 70, ALU 75 …)
--  * window_types    — window layouts (fixed, tilt&turn, double …);
--                      `template` is a code key the app knows how to draw
--  * window_prices   — per system × type: price matrix (width × height, mm)
--                      and/or fallback price per m² + minimum price
--  * window_options  — extras grouped by group_key (glass, colour, …),
--                      priced per piece, per m² or % of the base price
--  * companies.configurator_*  — public configurator settings (slug …)
--  * quotes.source, quote_lines.config — configurator-made quotes
--  * get_configurator(slug), submit_configuration(…) — anon RPCs.
--    Prices are always recomputed on the server (never trusted from the client).
-- ============================================================

-- ─── Catalog tables ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS window_systems (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text NOT NULL,
  material     text NOT NULL DEFAULT 'pvc' CHECK (material IN ('pvc','alu','wood','wood_alu')),
  description  text,
  sort_order   integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_window_systems_company ON window_systems(company_id);

CREATE TABLE IF NOT EXISTS window_types (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text NOT NULL,
  template     text NOT NULL CHECK (template IN (
                 'fixed','tilt_turn','tilt','double','double_mullion','triple',
                 'fixed_tilt_turn','door','door_double','lift_slide')),
  min_width    integer NOT NULL DEFAULT 400,
  max_width    integer NOT NULL DEFAULT 3000,
  min_height   integer NOT NULL DEFAULT 400,
  max_height   integer NOT NULL DEFAULT 2600,
  sort_order   integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_window_types_company ON window_types(company_id);

CREATE TABLE IF NOT EXISTS window_prices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  system_id     uuid NOT NULL REFERENCES window_systems(id) ON DELETE CASCADE,
  type_id       uuid NOT NULL REFERENCES window_types(id) ON DELETE CASCADE,
  -- {"widths":[600,800,…], "heights":[600,800,…], "prices":[[row for heights[0]], …]}
  matrix        jsonb NOT NULL DEFAULT '{"widths":[],"heights":[],"prices":[]}'::jsonb,
  price_per_m2  numeric(12,2) NOT NULL DEFAULT 0,
  min_price     numeric(12,2) NOT NULL DEFAULT 0,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (system_id, type_id)
);
CREATE INDEX IF NOT EXISTS idx_window_prices_company ON window_prices(company_id);

CREATE TABLE IF NOT EXISTS window_options (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  group_key    text NOT NULL CHECK (group_key IN ('glass','color','handle','sill','shading','other')),
  name         text NOT NULL,
  description  text,
  pricing      text NOT NULL DEFAULT 'piece' CHECK (pricing IN ('piece','m2','percent')),
  price        numeric(12,2) NOT NULL DEFAULT 0,
  is_default   boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_window_options_company ON window_options(company_id);

-- ─── RLS (same rules as the price list) ─────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['window_systems','window_types','window_prices','window_options'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_delete', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (company_id = get_my_company_id())', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (company_id = get_my_company_id() AND has_perm(''price_list'', ''create''))', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (company_id = get_my_company_id() AND has_perm(''price_list'', ''create'')) WITH CHECK (company_id = get_my_company_id())', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (company_id = get_my_company_id() AND has_perm(''price_list'', ''create''))', t || '_delete', t);
  END LOOP;
END $$;

-- ─── Company configurator settings ──────────────────────────
ALTER TABLE companies ADD COLUMN IF NOT EXISTS configurator_slug       text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS configurator_enabled    boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS configurator_show_prices boolean NOT NULL DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS configurator_accent     text NOT NULL DEFAULT '#2563eb';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS configurator_intro      text;

ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_configurator_slug_check;
ALTER TABLE companies ADD CONSTRAINT companies_configurator_slug_check
  CHECK (configurator_slug IS NULL OR configurator_slug ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$');
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_configurator_slug ON companies(configurator_slug)
  WHERE configurator_slug IS NOT NULL;

-- ─── Quotes from the configurator ───────────────────────────
ALTER TABLE quotes      ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE quote_lines ADD COLUMN IF NOT EXISTS config jsonb;

-- ─── Pricing ────────────────────────────────────────────────
-- Base price: matrix cell for the smallest width ≥ w and height ≥ h;
-- outside the matrix (or no matrix) → max(min_price, m² × price_per_m2).
CREATE OR REPLACE FUNCTION window_base_price(p_system uuid, p_type uuid, p_w integer, p_h integer)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r        window_prices%ROWTYPE;
  v_wi     integer;
  v_hi     integer;
  v_cell   numeric;
  v_area   numeric := (p_w::numeric * p_h::numeric) / 1000000;
BEGIN
  SELECT * INTO r FROM window_prices WHERE system_id = p_system AND type_id = p_type;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT (ord - 1)::integer INTO v_wi
  FROM jsonb_array_elements_text(COALESCE(r.matrix->'widths', '[]')) WITH ORDINALITY AS x(val, ord)
  WHERE val::integer >= p_w ORDER BY val::integer LIMIT 1;

  SELECT (ord - 1)::integer INTO v_hi
  FROM jsonb_array_elements_text(COALESCE(r.matrix->'heights', '[]')) WITH ORDINALITY AS x(val, ord)
  WHERE val::integer >= p_h ORDER BY val::integer LIMIT 1;

  IF v_wi IS NOT NULL AND v_hi IS NOT NULL THEN
    v_cell := NULLIF(r.matrix->'prices'->v_hi->>v_wi, '')::numeric;
    IF v_cell IS NOT NULL AND v_cell > 0 THEN RETURN v_cell; END IF;
  END IF;

  IF r.price_per_m2 > 0 THEN
    RETURN round(GREATEST(r.min_price, v_area * r.price_per_m2), 2);
  END IF;
  RETURN NULL;
END;
$$;

-- ─── Public: configurator data ──────────────────────────────
CREATE OR REPLACE FUNCTION get_configurator(p_slug text)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c companies%ROWTYPE;
BEGIN
  SELECT * INTO c FROM companies WHERE configurator_slug = lower(p_slug) AND configurator_enabled = true;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN json_build_object(
    'company', json_build_object(
      'name', c.name, 'logo_url', c.logo_url, 'email', c.email, 'phone', c.phone,
      'currency', c.currency, 'accent', c.configurator_accent, 'intro', c.configurator_intro,
      'show_prices', c.configurator_show_prices,
      'vat_rate', CASE WHEN COALESCE(c.vat_payer, true) THEN 22 ELSE 0 END
    ),
    'systems', COALESCE((SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'material', s.material, 'description', s.description) ORDER BY s.sort_order, s.name)
      FROM window_systems s WHERE s.company_id = c.id AND s.is_active), '[]'::json),
    'types', COALESCE((SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'template', t.template,
        'min_width', t.min_width, 'max_width', t.max_width, 'min_height', t.min_height, 'max_height', t.max_height) ORDER BY t.sort_order, t.name)
      FROM window_types t WHERE t.company_id = c.id AND t.is_active), '[]'::json),
    'prices', CASE WHEN c.configurator_show_prices THEN COALESCE((SELECT json_agg(json_build_object(
        'system_id', p.system_id, 'type_id', p.type_id, 'matrix', p.matrix, 'price_per_m2', p.price_per_m2, 'min_price', p.min_price))
      FROM window_prices p WHERE p.company_id = c.id), '[]'::json) ELSE '[]'::json END,
    -- which system × type combinations exist (needed even when prices are hidden)
    'combos', COALESCE((SELECT json_agg(json_build_object('system_id', p.system_id, 'type_id', p.type_id))
      FROM window_prices p WHERE p.company_id = c.id), '[]'::json),
    'options', COALESCE((SELECT json_agg(json_build_object('id', o.id, 'group_key', o.group_key, 'name', o.name, 'description', o.description,
        'pricing', o.pricing, 'price', CASE WHEN c.configurator_show_prices THEN o.price ELSE NULL END, 'is_default', o.is_default) ORDER BY o.group_key, o.sort_order, o.name)
      FROM window_options o WHERE o.company_id = c.id AND o.is_active), '[]'::json)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_configurator(text) TO anon, authenticated;

-- ─── Public: submit a configuration → customer + draft quote ─
-- p_customer: {first_name, last_name, email, phone, address, company_name?}
-- p_items:    [{system_id, type_id, width, height, quantity, hinge, option_ids:[], label}]
CREATE OR REPLACE FUNCTION submit_configuration(p_slug text, p_customer jsonb, p_items jsonb, p_note text DEFAULT NULL)
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
  v_net        numeric := 0;
  v_line_net   numeric;
  v_hinge      text;
BEGIN
  SELECT * INTO c FROM companies WHERE configurator_slug = lower(p_slug) AND configurator_enabled = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'configurator_not_found'; END IF;

  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF v_first = '' AND v_last = '' THEN RAISE EXCEPTION 'name_required'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  -- Simple abuse guard: max 5 configurator quotes per e-mail per hour per company
  IF (SELECT count(*) FROM quotes q JOIN customers cu ON cu.id = q.customer_id
      WHERE q.company_id = c.id AND q.source = 'configurator' AND lower(cu.email) = v_email
        AND q.created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  -- Owner = first active admin (created_by is NOT NULL on quotes)
  SELECT id INTO v_owner FROM users WHERE company_id = c.id AND is_admin AND COALESCE(is_active, true)
  ORDER BY created_at LIMIT 1;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'no_owner'; END IF;

  -- Customer: reuse by e-mail, otherwise create a private person
  SELECT id INTO v_customer FROM customers WHERE company_id = c.id AND lower(email) = v_email ORDER BY created_at LIMIT 1;
  IF v_customer IS NULL THEN
    INSERT INTO customers (company_id, name, customer_type, first_name, last_name, email, phone, address, notes)
    VALUES (c.id, trim(v_first || ' ' || v_last), 'person', NULLIF(v_first, ''), NULLIF(v_last, ''), v_email,
            NULLIF(trim(COALESCE(p_customer->>'phone', '')), ''), NULLIF(trim(COALESCE(p_customer->>'address', '')), ''),
            'Spletni konfigurator')
    RETURNING id INTO v_customer;
  END IF;

  -- Quote number (same format as generate_quote_number)
  UPDATE companies SET quote_counter = quote_counter + 1 WHERE id = c.id
  RETURNING quote_counter INTO v_number;
  v_qnum := COALESCE(NULLIF(c.quote_prefix, ''), 'P') || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_number::text, 4, '0');

  v_vat := CASE WHEN COALESCE(c.vat_payer, true) THEN 22 ELSE 0 END;

  INSERT INTO quotes (company_id, customer_id, quote_number, title, status, source, created_by, assignee_id,
                      site_address, notes, valid_until, payment_terms, contact_email, contact_phone)
  VALUES (c.id, v_customer, v_qnum, 'Okna – spletni konfigurator', 'draft', 'configurator', v_owner, v_owner,
          NULLIF(trim(COALESCE(p_customer->>'address', '')), ''), NULLIF(trim(COALESCE(p_note, '')), ''),
          current_date + COALESCE(c.default_valid_days, 30), c.default_payment_terms,
          v_email, NULLIF(trim(COALESCE(p_customer->>'phone', '')), ''))
  RETURNING id INTO v_quote;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pos := v_pos + 1;
    SELECT * INTO v_sys FROM window_systems WHERE id = (v_item->>'system_id')::uuid AND company_id = c.id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_system'; END IF;
    SELECT * INTO v_typ FROM window_types WHERE id = (v_item->>'type_id')::uuid AND company_id = c.id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_type'; END IF;

    v_w   := (v_item->>'width')::integer;
    v_h   := (v_item->>'height')::integer;
    v_qty := GREATEST(1, LEAST(100, COALESCE((v_item->>'quantity')::integer, 1)));
    IF v_w < v_typ.min_width OR v_w > v_typ.max_width OR v_h < v_typ.min_height OR v_h > v_typ.max_height THEN
      RAISE EXCEPTION 'size_out_of_range';
    END IF;
    v_hinge := CASE WHEN v_item->>'hinge' = 'right' THEN 'right' ELSE 'left' END;

    v_area := (v_w::numeric * v_h::numeric) / 1000000;
    v_base := COALESCE(window_base_price(v_sys.id, v_typ.id, v_w, v_h), 0);
    v_unit := v_base;
    v_opt_names := ARRAY[]::text[];
    v_opt_ids   := ARRAY[]::uuid[];

    FOR v_opt IN
      SELECT o.* FROM window_options o
      WHERE o.company_id = c.id AND o.is_active
        AND o.id IN (SELECT (x)::uuid FROM jsonb_array_elements_text(COALESCE(v_item->'option_ids', '[]')) x)
      ORDER BY o.group_key, o.sort_order
    LOOP
      v_unit := v_unit + CASE v_opt.pricing
        WHEN 'piece'   THEN v_opt.price
        WHEN 'm2'      THEN v_opt.price * v_area
        WHEN 'percent' THEN v_base * v_opt.price / 100
        ELSE 0 END;
      v_opt_names := v_opt_names || v_opt.name;
      v_opt_ids   := v_opt_ids || v_opt.id;
    END LOOP;

    v_unit := round(v_unit, 2);
    v_line_net := round(v_unit * v_qty, 2);
    v_net := v_net + v_line_net;

    INSERT INTO quote_lines (quote_id, company_id, position, room, name, description, unit, quantity, unit_price,
                             discount_pct, vat_rate, total_net, config)
    VALUES (v_quote, c.id, v_pos, NULLIF(trim(COALESCE(v_item->>'label', '')), ''),
            v_typ.name || ' ' || v_w || ' × ' || v_h || ' mm',
            v_sys.name || CASE WHEN array_length(v_opt_names, 1) > 0 THEN ' · ' || array_to_string(v_opt_names, ', ') ELSE '' END,
            'pcs', v_qty, v_unit, 0, v_vat, v_line_net,
            jsonb_build_object('system_id', v_sys.id, 'type_id', v_typ.id, 'template', v_typ.template,
                               'width', v_w, 'height', v_h, 'hinge', v_hinge, 'option_ids', to_jsonb(v_opt_ids)));
  END LOOP;

  UPDATE quotes SET total_net = round(v_net, 2), total_vat = round(v_net * v_vat / 100, 2),
                    total_gross = round(v_net, 2) + round(v_net * v_vat / 100, 2)
  WHERE id = v_quote;

  RETURN json_build_object('quote_number', v_qnum, 'total_net', round(v_net, 2),
                           'total_gross', round(v_net, 2) + round(v_net * v_vat / 100, 2));
END;
$$;
GRANT EXECUTE ON FUNCTION submit_configuration(text, jsonb, jsonb, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION window_base_price(uuid, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION window_base_price(uuid, uuid, integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
