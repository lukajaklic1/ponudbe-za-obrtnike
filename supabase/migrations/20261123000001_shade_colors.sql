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
