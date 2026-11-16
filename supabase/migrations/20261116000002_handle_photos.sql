-- ============================================================
-- 20261116000002_handle_photos.sql
-- Handles: the configurator also gets the RAL code and the photo of each handle
-- (window_pricing.handles[].code / .image_url). Only get_configurator changes.
-- ============================================================

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
      'handles', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x->>'id', 'name', x->>'name', 'look', x->>'look', 'code', x->>'code', 'image_url', x->>'image_url', 'lockable', COALESCE((x->>'lockable')::boolean, false),
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
