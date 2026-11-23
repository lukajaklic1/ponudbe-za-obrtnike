// Colours of shading (roller shutters, blinds, pleated blinds) and their boxes.
// A supplier can set its own list in the settings (window_pricing.shade_colors); without one the
// default list below is offered. The ids of the presets stay the same when a supplier adds one of
// them, so a customer's choice always resolves to a name (also on the server).

export interface ShadeColor { id: string; name: string; name_en?: string; hex: string }

/** colours to pick from when adding to the list: the ones suppliers offer most often first */
export const SHADE_PRESETS: ShadeColor[] = [
  { id: 'white', name: 'Bela', name_en: 'White', hex: '#f4f4f2' },
  { id: 'cream', name: 'Krem', name_en: 'Cream', hex: '#eadfc8' },
  { id: 'silver', name: 'Srebrna', name_en: 'Silver', hex: '#c3c6c8' },
  { id: 'grey', name: 'Siva', name_en: 'Grey', hex: '#8b9094' },
  { id: 'anthracite', name: 'Antracit', name_en: 'Anthracite', hex: '#383e42' },
  { id: 'black', name: 'Črna', name_en: 'Black', hex: '#1b1c1e' },
  { id: 'brown', name: 'Rjava', name_en: 'Brown', hex: '#5a3e2b' },
  { id: 'light_grey', name: 'Svetlo siva', name_en: 'Light grey', hex: '#c9cdd0' },
  { id: 'beige', name: 'Bež', name_en: 'Beige', hex: '#d8c9a8' },
  { id: 'dark_brown', name: 'Temno rjava', name_en: 'Dark brown', hex: '#3a2a20' },
]

/** what a customer sees when the supplier has not set a list of its own */
export const DEFAULT_SHADE_COLORS: ShadeColor[] = SHADE_PRESETS.slice(0, 7)

export const shadeColorsOf = (custom?: ShadeColor[] | null): ShadeColor[] => (custom && custom.length ? custom : DEFAULT_SHADE_COLORS)

/** the chosen colour; an unknown or empty key gives the first one of the list */
export const shadeColorOf = (list: ShadeColor[], key?: string | null): ShadeColor =>
  list.find(c => c.id === key) ?? SHADE_PRESETS.find(c => c.id === key) ?? list[0] ?? SHADE_PRESETS[0]

export const shadeColorName = (c: ShadeColor, lang: 'sl' | 'en') => (lang === 'en' && c.name_en) || c.name
