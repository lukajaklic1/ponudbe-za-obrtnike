// Sales channel of a quote ("Kje ste izvedeli za nas?"): the customer picks it in the configurator,
// in the app it is set on the quote (required in both). Stored as a key in quotes.lead_source; the reports group by it.
export const LEAD_SOURCES = ['google', 'facebook', 'instagram', 'referral', 'existing', 'fair', 'ad', 'other'] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

const LABELS: Record<'sl' | 'en', Record<LeadSource, string>> = {
  sl: { google: 'Google', facebook: 'Facebook', instagram: 'Instagram', referral: 'Priporočilo', existing: 'Obstoječa stranka', fair: 'Sejem ali razstava', ad: 'Oglas', other: 'Drugo' },
  en: { google: 'Google', facebook: 'Facebook', instagram: 'Instagram', referral: 'Recommendation', existing: 'Existing customer', fair: 'Trade fair', ad: 'Advert', other: 'Other' },
}
/** label of a channel (older quotes may still say "social") */
export function leadSourceLabel(key: string | null | undefined, lang: 'sl' | 'en'): string {
  if (key === 'social') return lang === 'sl' ? 'Facebook ali Instagram' : 'Facebook or Instagram'
  return key && key in LABELS[lang] ? LABELS[lang][key as LeadSource] : lang === 'sl' ? 'Drugo' : 'Other'
}
export const leadSourceOptions = (lang: 'sl' | 'en') => LEAD_SOURCES.map(k => ({ value: k, label: LABELS[lang][k] }))
