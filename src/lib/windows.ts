// Window CPQ: catalog types, layout templates and pricing.
// Pricing mirrors the SQL function window_base_price + submit_configuration —
// the server always recomputes; this is only for live display.

export type WindowMaterial = 'pvc' | 'pvc_alu' | 'alu' | 'wood' | 'wood_alu' | 'steel'
export type WindowTemplate =
  | 'fixed' | 'tilt_turn' | 'tilt' | 'double' | 'double_mullion' | 'triple'
  | 'fixed_tilt_turn' | 'tilt_turn_transom' | 'double_transom' | 'special'
  | 'door' | 'door_double' | 'door_side' | 'lift_slide' | 'psk'
export type ExtraGroup = 'glass' | 'color' | 'handle' | 'sill' | 'shading' | 'other'
export type ServiceGroup = 'installation' | 'removal' | 'finishing' | 'transport'
export type OptionGroup = ExtraGroup | ServiceGroup
/** piece / m² / % of base / metre of perimeter 2×(w+h) / metre of width / once per quote */
export type OptionPricing = 'piece' | 'm2' | 'percent' | 'perimeter' | 'width' | 'flat'
export type Hinge = 'left' | 'right'

export interface PriceMatrix { widths: number[]; heights: number[]; prices: (number | null)[][] }

export interface WindowSystem {
  id: string; company_id?: string; name: string; material: WindowMaterial
  description: string | null; sort_order?: number; is_active?: boolean
  /** guided price list: price per m² of this material and minimum price per window */
  price_per_m2?: number; min_price?: number
  /** photo or cross-section of the profile (public URL) */
  image_url?: string | null
  /** per-metre prices and visible widths (mm) for the metre costing */
  frame_m?: number; sash_m?: number; mullion_m?: number; bead_m?: number
  frame_w?: number; sash_w?: number; mullion_w?: number
}
export interface WindowType {
  id: string; company_id?: string; name: string; template: WindowTemplate
  min_width: number; max_width: number; min_height: number; max_height: number
  sort_order?: number; is_active?: boolean
  /** guided price list: % on top of the material price for this shape */
  surcharge_pct?: number
}
export interface WindowPrice {
  id?: string; company_id?: string; system_id: string; type_id: string
  matrix: PriceMatrix; price_per_m2: number; min_price: number
}
export interface WindowOption {
  id: string; company_id?: string; group_key: OptionGroup; name: string; description: string | null
  pricing: OptionPricing; price: number | null; is_default: boolean; sort_order?: number; is_active?: boolean
}

export const TEMPLATES: WindowTemplate[] = [
  'fixed', 'tilt_turn', 'tilt', 'double', 'double_mullion', 'triple', 'fixed_tilt_turn', 'tilt_turn_transom', 'double_transom', 'special',
  'door', 'door_double', 'door_side', 'lift_slide', 'psk',
]
/** Shapes without a computed price: the customer only sends sizes, the supplier prices it by hand. */
export const isOnRequest = (t: WindowTemplate) => t === 'special'
/** Balcony / terrace doors (shown as their own group in the price list). */
export const isDoor = (t: WindowTemplate) => t.startsWith('door') || t === 'lift_slide' || t === 'psk'
export const MATERIALS: WindowMaterial[] = ['pvc', 'pvc_alu', 'alu', 'wood', 'wood_alu']
/** Extras change the window itself (priced into the window line). */
export const OPTION_GROUPS: ExtraGroup[] = ['glass', 'color', 'handle', 'sill', 'shading', 'other']
/** Services are chosen once per order and become their own quote lines. */
export const SERVICE_GROUPS: ServiceGroup[] = ['installation', 'removal', 'finishing', 'transport']
export const EXTRA_PRICING: OptionPricing[] = ['piece', 'm2', 'percent', 'perimeter', 'width']
export const SERVICE_PRICING: OptionPricing[] = ['piece', 'perimeter', 'width', 'm2', 'flat']
export const isService = (o: { group_key: OptionGroup; pricing: OptionPricing }) => (SERVICE_GROUPS as string[]).includes(o.group_key) || o.pricing === 'flat'
/** Groups where the customer picks exactly one option; the rest are optional add-ons. */
export const SINGLE_CHOICE_GROUPS: OptionGroup[] = ['glass', 'color', 'handle']

/** Templates with a single opening sash where the customer chooses the hinge side. */
export function hasHingeChoice(t: WindowTemplate) {
  return t === 'tilt_turn' || t === 'fixed_tilt_turn' || t === 'tilt_turn_transom' || t === 'door' || t === 'door_side' || t === 'lift_slide' || t === 'psk'
}

// ─── Sash layout per template (used by the drawing) ─────────
export type SashKind = 'fixed' | 'turn' | 'tilt' | 'tilt_turn' | 'slide' | 'slide_tilt'
export interface Sash { kind: SashKind; hinge?: Hinge; weight: number; mullionAfter?: boolean; door?: boolean }

export function sashesFor(t: WindowTemplate, hinge: Hinge = 'left'): Sash[] {
  const other: Hinge = hinge === 'left' ? 'right' : 'left'
  switch (t) {
    case 'fixed':           return [{ kind: 'fixed', weight: 1 }]
    case 'tilt_turn':       return [{ kind: 'tilt_turn', hinge, weight: 1 }]
    case 'tilt':            return [{ kind: 'tilt', weight: 1 }]
    case 'double':          return [{ kind: 'turn', hinge: 'left', weight: 1 }, { kind: 'tilt_turn', hinge: 'right', weight: 1 }]
    case 'double_mullion':  return [{ kind: 'tilt_turn', hinge: 'left', weight: 1, mullionAfter: true }, { kind: 'tilt_turn', hinge: 'right', weight: 1 }]
    case 'triple':          return [
      { kind: 'tilt_turn', hinge: 'left', weight: 1, mullionAfter: true },
      { kind: 'fixed', weight: 1, mullionAfter: true },
      { kind: 'tilt_turn', hinge: 'right', weight: 1 },
    ]
    case 'fixed_tilt_turn': return hinge === 'left'
      ? [{ kind: 'tilt_turn', hinge: 'left', weight: 1, mullionAfter: true }, { kind: 'fixed', weight: 1 }]
      : [{ kind: 'fixed', weight: 1, mullionAfter: true }, { kind: 'tilt_turn', hinge: 'right', weight: 1 }]
    case 'door':            return [{ kind: 'tilt_turn', hinge, weight: 1, door: true }]
    case 'door_double':     return [{ kind: 'turn', hinge: 'left', weight: 1, door: true }, { kind: 'tilt_turn', hinge: 'right', weight: 1, door: true }]
    case 'lift_slide':      return hinge === 'left'
      ? [{ kind: 'slide', hinge: other, weight: 1, door: true, mullionAfter: true }, { kind: 'fixed', weight: 1, door: true }]
      : [{ kind: 'fixed', weight: 1, door: true, mullionAfter: true }, { kind: 'slide', hinge: other, weight: 1, door: true }]
    case 'psk':             return hinge === 'left'
      ? [{ kind: 'slide_tilt', hinge: other, weight: 1, door: true, mullionAfter: true }, { kind: 'fixed', weight: 1, door: true }]
      : [{ kind: 'fixed', weight: 1, door: true, mullionAfter: true }, { kind: 'slide_tilt', hinge: other, weight: 1, door: true }]
    case 'door_side':       return hinge === 'left'
      ? [{ kind: 'tilt_turn', hinge: 'left', weight: 1, door: true, mullionAfter: true }, { kind: 'fixed', weight: 0.6, door: true }]
      : [{ kind: 'fixed', weight: 0.6, door: true, mullionAfter: true }, { kind: 'tilt_turn', hinge: 'right', weight: 1, door: true }]
    case 'tilt_turn_transom': return [{ kind: 'tilt_turn', hinge, weight: 1 }]
    case 'double_transom':  return [{ kind: 'turn', hinge: 'left', weight: 1 }, { kind: 'tilt_turn', hinge: 'right', weight: 1 }]
    case 'special':         return [{ kind: 'fixed', weight: 1 }]
  }
}

/** Fixed top light (nadsvetloba) above the main sashes, or null. */
export function transomFor(t: WindowTemplate): Sash[] | null {
  return t === 'tilt_turn_transom' || t === 'double_transom' ? [{ kind: 'fixed', weight: 1 }] : null
}

// ─── Pricing ────────────────────────────────────────────────
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function basePrice(p: WindowPrice | undefined, w: number, h: number): number | null {
  if (!p) return null
  const m = p.matrix ?? { widths: [], heights: [], prices: [] }
  const wi = indexAtLeast(m.widths ?? [], w)
  const hi = indexAtLeast(m.heights ?? [], h)
  if (wi != null && hi != null) {
    const cell = m.prices?.[hi]?.[wi]
    if (cell != null && Number(cell) > 0) return Number(cell)
  }
  if (Number(p.price_per_m2) > 0) return r2(Math.max(Number(p.min_price) || 0, (w * h / 1_000_000) * Number(p.price_per_m2)))
  return null
}

function indexAtLeast(values: number[], v: number): number | null {
  let best: number | null = null
  values.forEach((x, i) => { if (Number(x) >= v && (best == null || Number(x) < Number(values[best]))) best = i })
  return best
}

export function unitPrice(base: number | null, w: number, h: number, options: WindowOption[]): number | null {
  if (base == null) return null
  const area = w * h / 1_000_000
  let total = base
  for (const o of options) {
    const price = Number(o.price ?? 0)
    total += o.pricing === 'piece' ? price
      : o.pricing === 'm2' ? price * area
      : o.pricing === 'percent' ? base * price / 100
      : o.pricing === 'perimeter' ? price * 2 * (w + h) / 1000
      : o.pricing === 'width' ? price * w / 1000
      : 0
  }
  return r2(total)
}

/** Services for a whole order: quantity summed over all windows (same rules as the server). */
export function serviceLine(o: WindowOption, windows: { width: number; height: number; quantity: number; base: number | null }[]) {
  const price = Number(o.price ?? 0)
  let qty = 0
  for (const w of windows) {
    const q = w.quantity || 0
    if (o.pricing === 'piece') qty += q
    else if (o.pricing === 'm2') qty += (w.width * w.height / 1_000_000) * q
    else if (o.pricing === 'perimeter') qty += 2 * (w.width + w.height) / 1000 * q
    else if (o.pricing === 'width') qty += w.width / 1000 * q
  }
  if (o.pricing === 'flat') return { qty: 1, unitPrice: r2(price), total: r2(price) }
  if (o.pricing === 'percent') {
    const sum = windows.reduce((a, w) => a + (w.base ?? 0) * (w.quantity || 0), 0)
    return { qty: 1, unitPrice: r2(sum * price / 100), total: r2(sum * price / 100) }
  }
  qty = r2(qty)
  return { qty, unitPrice: r2(price), total: r2(qty * price) }
}

export function money(n: number, currency = 'EUR') {
  return Number(n).toLocaleString('de-DE', { style: 'currency', currency })
}

// ─── Paste a price matrix from Excel ────────────────────────
// First row: (empty cell), widths…; every next row: height, prices…
export function parseMatrix(text: string): PriceMatrix | null {
  const num = (s: string) => {
    const c = s.trim().replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
    if (c === '') return null
    const n = Number(c)
    return isNaN(n) ? null : n
  }
  const rows = text.trim().split(/\r?\n/).map(r => r.split(/\t|;/))
  if (rows.length < 2) return null
  const widths = rows[0].slice(1).map(num).filter((n): n is number => n != null)
  if (!widths.length) return null
  const heights: number[] = []
  const prices: (number | null)[][] = []
  for (const r of rows.slice(1)) {
    const h = num(r[0] ?? '')
    if (h == null) continue
    heights.push(h)
    prices.push(widths.map((_, i) => num(r[i + 1] ?? '')))
  }
  return heights.length ? { widths, heights, prices } : null
}

// ─── Starter catalog (one click, so a new company can try the configurator) ─
export const STARTER = {
  systems: [
    { name: 'PVC 76 mm, 6 komor', material: 'pvc' as const, description: 'Uw do 0,9 W/m²K, standardna tesnila' },
    { name: 'PVC 82 mm, 7 komor', material: 'pvc' as const, description: 'Uw do 0,75 W/m²K, primerno za pasivne hiše' },
    { name: 'ALU 75 mm', material: 'alu' as const, description: 'Aluminijasti sistem s prekinjenim toplotnim mostom' },
  ],
  // relative price factor per m² vs. the system base
  types: [
    { name: 'Fiksno okno', template: 'fixed' as const, factor: 0.7, max_width: 3000, max_height: 2600 },
    { name: 'Enokrilno okno, odpiranje in kip', template: 'tilt_turn' as const, factor: 1, max_width: 1300, max_height: 1800 },
    { name: 'Kip okno', template: 'tilt' as const, factor: 0.9, max_width: 1300, max_height: 900 },
    { name: 'Dvokrilno okno brez stebrička', template: 'double' as const, factor: 1.1, max_width: 2200, max_height: 1800 },
    { name: 'Dvokrilno okno s stebričkom', template: 'double_mullion' as const, factor: 1.15, max_width: 2400, max_height: 1800 },
    { name: 'Trokrilno okno', template: 'triple' as const, factor: 1.2, max_width: 3200, max_height: 1800 },
    { name: 'Balkonska vrata', template: 'door' as const, factor: 1.2, max_width: 1200, max_height: 2500 },
    { name: 'Dvokrilna balkonska vrata', template: 'door_double' as const, factor: 1.25, max_width: 2200, max_height: 2500 },
  ],
  basePerM2: { 'PVC 76 mm, 6 komor': 230, 'PVC 82 mm, 7 komor': 290, 'ALU 75 mm': 480 } as Record<string, number>,
  options: [
    { group_key: 'glass' as const, name: 'Dvoslojno steklo Ug 1,1', pricing: 'm2' as const, price: 0, is_default: true },
    { group_key: 'glass' as const, name: 'Troslojno steklo Ug 0,6', pricing: 'm2' as const, price: 45, is_default: false },
    { group_key: 'glass' as const, name: 'Troslojno varnostno steklo', pricing: 'm2' as const, price: 85, is_default: false },
    { group_key: 'color' as const, name: 'Bela', pricing: 'percent' as const, price: 0, is_default: true },
    { group_key: 'color' as const, name: 'Antracit zunaj, bela znotraj', pricing: 'percent' as const, price: 15, is_default: false },
    { group_key: 'color' as const, name: 'Zlati hrast obojestransko', pricing: 'percent' as const, price: 25, is_default: false },
    { group_key: 'handle' as const, name: 'Standardna kljuka', pricing: 'piece' as const, price: 0, is_default: true },
    { group_key: 'handle' as const, name: 'Kljuka s ključem', pricing: 'piece' as const, price: 28, is_default: false },
    { group_key: 'sill' as const, name: 'Notranja polica (PVC)', pricing: 'piece' as const, price: 45, is_default: false },
    { group_key: 'sill' as const, name: 'Zunanja ALU okenska polica', pricing: 'piece' as const, price: 55, is_default: false },
    { group_key: 'shading' as const, name: 'Zunanje žaluzije', pricing: 'm2' as const, price: 160, is_default: false },
    { group_key: 'shading' as const, name: 'Komarnik', pricing: 'piece' as const, price: 65, is_default: false },
    { group_key: 'sill' as const, name: 'Notranja polica po meri', pricing: 'width' as const, price: 38, is_default: false },
    // services (chosen once per order, quantity from all windows)
    { group_key: 'installation' as const, name: 'Klasična montaža (PU pena, sidra)', pricing: 'perimeter' as const, price: 9, is_default: false },
    { group_key: 'installation' as const, name: 'RAL montaža (tesnilni trakovi)', pricing: 'perimeter' as const, price: 16, is_default: true },
    { group_key: 'installation' as const, name: 'Montaža balkonskih vrat', pricing: 'piece' as const, price: 120, is_default: false },
    { group_key: 'removal' as const, name: 'Demontaža starih oken', pricing: 'perimeter' as const, price: 6, is_default: true },
    { group_key: 'finishing' as const, name: 'Zidarska obdelava špalet', pricing: 'perimeter' as const, price: 12, is_default: false },
    { group_key: 'finishing' as const, name: 'Montaža notranjih polic', pricing: 'width' as const, price: 14, is_default: false },
    { group_key: 'transport' as const, name: 'Odvoz in ekološka odstranitev', pricing: 'flat' as const, price: 80, is_default: true },
    { group_key: 'transport' as const, name: 'Dostava na objekt', pricing: 'flat' as const, price: 50, is_default: true },
  ],
}

// ─── Labels (SL / EN) ───────────────────────────────────────
export const WL = {
  sl: {
    templates: {
      fixed: 'Fiksno', tilt_turn: 'Enokrilno, odpiranje in kip', tilt: 'Kip', double: 'Dvokrilno brez stebrička',
      double_mullion: 'Dvokrilno s stebričkom', triple: 'Trokrilno', fixed_tilt_turn: 'Fiksno + krilo na odpiranje in kip',
      tilt_turn_transom: 'Enokrilno z nadsvetlobo', double_transom: 'Dvokrilno z nadsvetlobo', special: 'Posebna oblika (ločno, poševno, okroglo)',
      door: 'Balkonska vrata', door_double: 'Dvokrilna balkonska vrata', door_side: 'Balkonska vrata s fiksnim delom ob strani', lift_slide: 'Dvižno-drsna vrata', psk: 'PSK vrata (vzporedno drsno-kip)',
    } as Record<WindowTemplate, string>,
    materials: { pvc: 'PVC', pvc_alu: 'PVC-ALU', alu: 'ALU', wood: 'Les', wood_alu: 'Les-ALU', steel: 'Jeklo' } as Record<WindowMaterial, string>,
    groups: { glass: 'Steklo', color: 'Barva', handle: 'Kljuka', sill: 'Police', shading: 'Senčila', other: 'Dodatno', installation: 'Montaža', removal: 'Demontaža', finishing: 'Zaključna dela', transport: 'Prevoz in odvoz' } as Record<OptionGroup, string>,
    pricing: { piece: 'na kos', m2: 'na m²', percent: '% cene okna', perimeter: 'na tm obsega okna', width: 'na tm širine okna', flat: 'pavšal na ponudbo' } as Record<OptionPricing, string>,
    unitShort: { piece: 'kos', m2: 'm²', percent: '%', perimeter: 'tm', width: 'tm', flat: 'pavšal' } as Record<OptionPricing, string>,
    hinge: { left: 'Levo', right: 'Desno' } as Record<Hinge, string>,
  },
  en: {
    templates: {
      fixed: 'Fixed', tilt_turn: 'Single sash (tilt & turn)', tilt: 'Tilt', double: 'Double sash, no mullion',
      double_mullion: 'Double sash with mullion', triple: 'Triple sash', fixed_tilt_turn: 'Fixed + tilt & turn',
      tilt_turn_transom: 'Single sash with transom', double_transom: 'Double sash with transom', special: 'Special shape (arched, sloped, round)',
      door_side: 'Balcony door with fixed side light', psk: 'Parallel slide-tilt door (PSK)',
      door: 'Balcony door', door_double: 'Double balcony door', lift_slide: 'Lift & slide door',
    } as Record<WindowTemplate, string>,
    materials: { pvc: 'PVC', pvc_alu: 'PVC-aluminium', alu: 'Aluminium', wood: 'Wood', wood_alu: 'Wood-aluminium', steel: 'Steel' } as Record<WindowMaterial, string>,
    groups: { glass: 'Glass', color: 'Colour', handle: 'Handle', sill: 'Sills', shading: 'Shading', other: 'Extras', installation: 'Installation', removal: 'Removal', finishing: 'Finishing', transport: 'Transport and disposal' } as Record<OptionGroup, string>,
    pricing: { piece: 'per piece', m2: 'per m²', percent: '% of window base', perimeter: 'per m of perimeter', width: 'per m of width', flat: 'flat per quote' } as Record<OptionPricing, string>,
    unitShort: { piece: 'pc', m2: 'm²', percent: '%', perimeter: 'm', width: 'm', flat: 'flat' } as Record<OptionPricing, string>,
    hinge: { left: 'Left', right: 'Right' } as Record<Hinge, string>,
  },
}
