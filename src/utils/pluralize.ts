/**
 * Slovensko množinsko sklanjanje
 * 1 → ednina, 2 → dvojina, 3-4 → množina, 5+ → rodilnik množine
 * Posebnost: 11, 12 → vedno rodilnik množine
 */
export function slPlural(n: number, ednina: string, dvojina: string, mnozina: string, rodilnik: string): string {
  // Slovensko sklanjanje: samo točno 1, 2, 3, 4 imajo posebne oblike
  // Vse ostalo (0, 5+, 11, 12, 21, 22, 101...) → rodilnik množine
  if (n === 1) return ednina
  if (n === 2) return dvojina
  if (n === 3 || n === 4) return mnozina
  return rodilnik
}

// Jezikovno odvisen števec: SL uporabi sklanjanje, EN preprosto ednina/množina.
export function plural(
  lang: 'en' | 'sl', n: number,
  sl: [string, string, string, string], en: [string, string],
): string {
  if (lang === 'sl') return `${n} ${slPlural(n, sl[0], sl[1], sl[2], sl[3])}`
  return `${n} ${n === 1 ? en[0] : en[1]}`
}

export const countUsers = (lang: 'en' | 'sl', n: number) => plural(lang, n, ['uporabnik', 'uporabnika', 'uporabniki', 'uporabnikov'], ['user', 'users'])
export const countCustomers = (lang: 'en' | 'sl', n: number) => plural(lang, n, ['stranka', 'stranki', 'stranke', 'strank'], ['customer', 'customers'])
export const countMachines = (lang: 'en' | 'sl', n: number) => plural(lang, n, ['stroj', 'stroja', 'stroji', 'strojev'], ['machine', 'machines'])
export const countWorkers = (lang: 'en' | 'sl', n: number) => plural(lang, n, ['delavec', 'delavca', 'delavci', 'delavcev'], ['worker', 'workers'])
export const countQuotes = (lang: 'en' | 'sl', n: number) => plural(lang, n, ['ponudba', 'ponudbi', 'ponudbe', 'ponudb'], ['quote', 'quotes'])
export const countMaterials = (lang: 'en' | 'sl', n: number) => plural(lang, n, ['material', 'materiala', 'materiali', 'materialov'], ['material', 'materials'])
export const countAttachments = (lang: 'en' | 'sl', n: number) => plural(lang, n, ['Priloga', 'Prilogi', 'Priloge', 'Prilog'], ['Attachment', 'Attachments'])

// Predpripravljene funkcije za vsako entiteto

export function stDobaviteljev(n: number) {
  return `${n} ${slPlural(n, 'aktiven dobavitelj', 'aktivna dobavitelja', 'aktivni dobavitelji', 'aktivnih dobaviteljev')}`
}

export function stArtiklov(n: number) {
  return `${n} ${slPlural(n, 'aktiven artikel', 'aktivna artikla', 'aktivni artikli', 'aktivnih artiklov')}`
}

export function stProjektov(n: number) {
  return `${n} ${slPlural(n, 'aktiven projekt', 'aktivna projekta', 'aktivni projekti', 'aktivnih projektov')}`
}

export function stKategorij(n: number) {
  return `${n} ${slPlural(n, 'kategorija', 'kategoriji', 'kategorije', 'kategorij')}`
}

export function stOddelkov(n: number) {
  return `${n} ${slPlural(n, 'oddelek', 'oddelka', 'oddelki', 'oddelkov')}`
}

export function stLokacij(n: number) {
  return `${n} ${slPlural(n, 'lokacija', 'lokaciji', 'lokacije', 'lokacij')}`
}

export function stNarocil(n: number) {
  return `${n} ${slPlural(n, 'naročilo', 'naročili', 'naročila', 'naročil')}`
}

export function stOdprtihNarocil(n: number) {
  return `${n} ${slPlural(n, 'odprto naročilo', 'odprti naročili', 'odprta naročila', 'odprtih naročil')}`
}
