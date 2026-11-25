// The supplier's own configurator look: only changed values are stored (companies.configurator_theme), the rest is default.
export const THEME_FONTS: { key: string; label: string; stack: string | null }[] = [
  { key: 'default', label: 'Privzeta (Inter)', stack: null },
  { key: 'system', label: 'Sistemska', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { key: 'arial', label: 'Arial', stack: "Arial, 'Helvetica Neue', Helvetica, sans-serif" },
  { key: 'verdana', label: 'Verdana', stack: "Verdana, Geneva, sans-serif" },
  { key: 'trebuchet', label: 'Trebuchet', stack: "'Trebuchet MS', 'Lucida Grande', sans-serif" },
  { key: 'georgia', label: 'Georgia (serif)', stack: "Georgia, 'Times New Roman', serif" },
]
export const THEME_DEFAULTS = { bg: '#f5f5f6', button: '#101112', ink: '#111827', muted: '#3f3f46', border: '#eeeff1' }
