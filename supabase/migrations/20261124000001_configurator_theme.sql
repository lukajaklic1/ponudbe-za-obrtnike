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
