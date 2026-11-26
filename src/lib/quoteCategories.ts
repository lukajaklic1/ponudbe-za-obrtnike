// The main categories of what a quote contains, for the reports: not every window on its own (each one is different),
// but windows, sliding windows, balcony doors, sliding walls, roof windows, sills and shading, services and the rest.

export type QuoteCategory = 'windows' | 'sliding' | 'doors' | 'walls' | 'roof' | 'extras' | 'services' | 'other'

export const CATEGORIES: { key: QuoteCategory; sl: string; en: string }[] = [
  { key: 'windows', sl: 'Okna', en: 'Windows' },
  { key: 'sliding', sl: 'Drsna okna', en: 'Sliding windows' },
  { key: 'doors', sl: 'Balkonska vrata', en: 'Balcony doors' },
  { key: 'walls', sl: 'Drsne stene', en: 'Sliding walls' },
  { key: 'roof', sl: 'Strešna okna', en: 'Roof windows' },
  { key: 'extras', sl: 'Police in senčila', en: 'Sills and shading' },
  { key: 'services', sl: 'Storitve', en: 'Services' },
  { key: 'other', sl: 'Ostalo', en: 'Other' },
]
export const categoryLabel = (key: string, lang: 'sl' | 'en') => CATEGORIES.find(c => c.key === key)?.[lang] ?? key

/** the category of one quote line, from the configuration the line was made with (free lines are "other") */
export function categoryOfLine(config: unknown, name?: string, serviceNames?: Set<string>): QuoteCategory {
  const c = config as { kind?: string; item?: { roof?: unknown; spec?: { kind?: string } | null }; template?: string | null; roof?: unknown; spec?: { kind?: string } | null; type_id?: string } | null | undefined
  // a window that came in through the customer's configurator has no kind, but it has what the configurator stored
  if (c && !c.kind && (c.type_id || c.roof || c.spec)) {
    if (c.roof || c.template === 'roof') return 'roof'
    const k0 = c.spec?.kind
    if (k0 === 'sliding') return 'sliding'
    if (k0 === 'door') return 'doors'
    if (k0 === 'wall') return 'walls'
    if (!c.spec && c.template && (c.template.startsWith('door') || c.template === 'lift_slide')) return 'doors'
    return 'windows'
  }
  if (!c || !c.kind) return name && serviceNames?.has(name.trim().toLowerCase()) ? 'services' : 'other'
  if (c.kind === 'service') return 'services'
  if (c.kind === 'sub') return 'extras'
  if (c.kind !== 'window') return 'other'
  if (c.item?.roof) return 'roof'
  const k = c.item?.spec?.kind
  if (k === 'sliding') return 'sliding'
  if (k === 'door') return 'doors'
  if (k === 'wall') return 'walls'
  if (!c.item?.spec && c.template && (c.template.startsWith('door') || c.template === 'lift_slide')) return 'doors'
  return 'windows'
}
