// Window costing like a window maker does it: profile metres, glass area, hardware per
// opening sash, labour and margin. All lengths in mm, prices per metre / m² / piece.
//
//   cost = frame + mullions/transoms + sashes + glazing beads   (profile metres × €/m, + waste %)
//        + glass m² × €/m²
//        + hardware per opening sash (by opening type) + labour (per window + per sash)
//   price = cost × (1 + margin %)
//
// The same function is used for the price list preview and (later) the configurator.

import type { WindowTemplate } from './windows'

export type Opening = 'fixed' | 'tilt' | 'turn' | 'tilt_turn' | 'passive' | 'slide_window' | 'slide' | 'lift_slide'
export type Hinge = 'left' | 'right'
export interface Field { opening: Opening; weight?: number; hinge?: Hinge }
export interface Layout {
  /** main row, left to right */
  cols: Field[]
  /** a mullion (stebriček) between neighbouring columns; false = sashes meet without one */
  mullions?: boolean[]
  /** top light / bottom panel (nadsvetloba / parapet): one field across, or split above each column */
  top?: { fields: Field[]; ratio: number } | null
  bottom?: { fields: Field[]; ratio: number } | null
  door?: boolean
}

export interface ProfilePrices {
  frame_m: number; sash_m: number; mullion_m: number; bead_m: number
  /** visible widths in mm (defaults below) */
  frame_w?: number; sash_w?: number; mullion_w?: number
}
export interface PricingSettings {
  /** hardware per opening sash: fixed price + price per metre of the sash perimeter */
  hw: Record<Exclude<Opening, 'fixed'>, number>
  hw_m: Record<Exclude<Opening, 'fixed'>, number>
  glass_m2: number
  labour_window: number
  labour_sash: number
  waste_pct: number
  margin_pct: number
  both_sides_pct: number
  /** what the supplier offers in the configurator */
  offer: Offer
}

/** Product categories and window variants the supplier offers (Cenik step 1). */
export interface Offer {
  windows: boolean
  sashes: number[]            // 1–4
  top: boolean; topSplit: boolean; bottom: boolean; bottomSplit: boolean
  openings: { tilt: boolean; turn: boolean; tilt_turn: boolean; passive: boolean }
  doors: boolean; sliding: boolean; special: boolean
  /** sliding windows (drsna okna) */
  slidingWindows: boolean
  /** opening combinations the supplier makes, per number of sashes (missing = all) */
  combos?: Record<string, string[]>
  /** top light / bottom panel variants per number of sashes: none, top, topSplit, bottom, bottomSplit (missing = all) */
  bands?: Record<string, string[]>
  /** per window type and top light variant ("3:top"): may it be fixed and/or tilt (missing = both) */
  bandModes?: Record<string, string[]>
}
export const DEFAULT_OFFER: Offer = {
  windows: true, sashes: [1, 2, 3, 4], top: true, topSplit: true, bottom: true, bottomSplit: true,
  openings: { tilt: true, turn: true, tilt_turn: true, passive: true }, doors: true, sliding: true, special: false, slidingWindows: true,
}

export const DEFAULT_PRICING: PricingSettings = {
  hw: { tilt_turn: 20, turn: 15, tilt: 18, passive: 10, slide_window: 40, slide: 120, lift_slide: 450 },
  hw_m: { tilt_turn: 1, turn: 1, tilt: 1, passive: 0.5, slide_window: 2, slide: 5, lift_slide: 20 },
  glass_m2: 32, labour_window: 30, labour_sash: 22, waste_pct: 6, margin_pct: 45, both_sides_pct: 10,
  offer: DEFAULT_OFFER,
}

/** Typical per-metre purchase prices per material (sample price list; the supplier edits them). */
export const SAMPLE_PROFILE_PRICES: Record<string, ProfilePrices> = {
  pvc:      { frame_m: 11, sash_m: 12, mullion_m: 13, bead_m: 1.8 },
  pvc_alu:  { frame_m: 18, sash_m: 19, mullion_m: 20, bead_m: 1.8 },
  alu:      { frame_m: 28, sash_m: 30, mullion_m: 32, bead_m: 3 },
  wood:     { frame_m: 26, sash_m: 28, mullion_m: 30, bead_m: 3 },
  wood_alu: { frame_m: 38, sash_m: 40, mullion_m: 42, bead_m: 3 },
  steel:    { frame_m: 60, sash_m: 64, mullion_m: 66, bead_m: 4 },
}

const OVERLAP = 8 // sash overlaps the frame opening on each side

/** Every shape of the price list expressed as a layout. */
export function layoutFor(t: WindowTemplate): Layout {
  const tt: Field = { opening: 'tilt_turn' }, fx: Field = { opening: 'fixed' }
  switch (t) {
    case 'fixed': return { cols: [fx] }
    case 'tilt_turn': return { cols: [tt] }
    case 'tilt': return { cols: [{ opening: 'tilt' }] }
    case 'double': return { cols: [{ opening: 'passive' }, tt], mullions: [false] }
    case 'double_mullion': return { cols: [tt, tt], mullions: [true] }
    case 'triple': return { cols: [tt, fx, tt], mullions: [true, true] }
    case 'fixed_tilt_turn': return { cols: [tt, fx], mullions: [true] }
    case 'tilt_turn_transom': return { cols: [tt], top: { fields: [fx], ratio: 0.25 } }
    case 'double_transom': return { cols: [{ opening: 'passive' }, tt], mullions: [false], top: { fields: [fx], ratio: 0.25 } }
    case 'special': return { cols: [fx] }
    case 'door': return { cols: [tt], door: true }
    case 'door_double': return { cols: [{ opening: 'passive' }, tt], mullions: [false], door: true }
    case 'door_side': return { cols: [tt, { opening: 'fixed', weight: 0.6 }], mullions: [true], door: true }
    case 'psk': return { cols: [{ opening: 'slide' }, fx], mullions: [true], door: true }
    case 'lift_slide': return { cols: [{ opening: 'lift_slide' }, fx], mullions: [true], door: true }
  }
}

export interface CutLine { key: string; label: string; qty: number; unit: 'm' | 'm²' | 'kos'; price: number; total: number }
export interface Costing {
  lines: CutLine[]
  profileCost: number
  cost: number
  price: number
  /** helpful numbers for the summary */
  frameLen: number; sashLen: number; mullionLen: number; beadLen: number; glassArea: number; sashes: number
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * @param colorPct colour surcharge on the profiles (foil / powder coat), e.g. 15
 * @param glassExtraM2 surcharge of the chosen glass per m² of glass (on top of the base glass)
 */
export function costWindow(layout: Layout, W: number, H: number, p: ProfilePrices, s: PricingSettings,
  opts: { colorPct?: number; bothSides?: boolean; glassExtraM2?: number; labels?: Partial<Record<string, string>> } = {}): Costing {
  const fw = p.frame_w ?? 70, sw = p.sash_w ?? 78, mw = p.mullion_w ?? 82
  const L = (k: string, d: string) => opts.labels?.[k] ?? d
  const cols = layout.cols
  const topH = layout.top ? Math.round(H * layout.top.ratio) : 0
  const botH = layout.bottom ? Math.round(H * layout.bottom.ratio) : 0
  const innerW = W - 2 * fw

  let mullionLen = 0, sashLen = 0, beadLen = 0, glassArea = 0, sashes = 0
  const hw: Record<string, { n: number; total: number }> = {}

  // a field = clear opening inside the frame / mullions
  function field(f: Field, cw: number, ch: number) {
    if (cw <= 0 || ch <= 0) return
    if (f.opening === 'fixed') {
      beadLen += 2 * (cw + ch)
      glassArea += (cw * ch) / 1e6
      return
    }
    sashes++
    const sashW = cw + 2 * OVERLAP, sashH = ch + 2 * OVERLAP
    sashLen += 2 * (sashW + sashH)
    const gw = Math.max(0, sashW - 2 * sw), gh = Math.max(0, sashH - 2 * sw)
    beadLen += 2 * (gw + gh)
    glassArea += (gw * gh) / 1e6
    const k = f.opening as keyof PricingSettings['hw']
    const cur = hw[k] ?? { n: 0, total: 0 }
    hw[k] = { n: cur.n + 1, total: cur.total + (s.hw[k] ?? 0) + (s.hw_m?.[k] ?? 0) * 2 * (sashW + sashH) / 1000 }
  }

  // main row
  const mainTop = topH ? topH + mw / 2 : fw
  const mainBottom = botH ? H - botH - mw / 2 : H - fw
  const mainH = mainTop < mainBottom ? mainBottom - mainTop : 0
  const mulls = layout.mullions ?? cols.slice(1).map(() => true)
  const nMull = mulls.filter(Boolean).length
  const totalWeight = cols.reduce((a, c) => a + (c.weight ?? 1), 0)
  const widthForFields = innerW - nMull * mw
  cols.forEach(c => field(c, widthForFields * (c.weight ?? 1) / totalWeight, mainH))
  mullionLen += nMull * mainH
  // top light / bottom panel: transom bar across the window, then one field or one per column
  for (const band of [layout.top ? { b: layout.top, h: topH } : null, layout.bottom ? { b: layout.bottom, h: botH } : null]) {
    if (!band) continue
    const fh = band.h - fw - mw / 2, n = band.b.fields.length
    mullionLen += innerW + (n - 1) * Math.max(0, fh)
    const fwid = (innerW - (n - 1) * mw) / n
    band.b.fields.forEach(f => field(f, fwid, fh))
  }

  const frameLen = 2 * (W + H)
  const waste = 1 + (s.waste_pct ?? 0) / 100
  const colorF = 1 + ((opts.colorPct ?? 0) + (opts.colorPct && opts.bothSides ? s.both_sides_pct : 0)) / 100
  const m = (mm: number) => (mm / 1000) * waste

  const lines: CutLine[] = []
  const add = (key: string, label: string, qty: number, unit: CutLine['unit'], price: number) => {
    if (qty > 0) lines.push({ key, label, qty: r2(qty), unit, price: r2(price), total: r2(qty * price) })
  }
  add('frame', L('frame', 'Okvir'), m(frameLen), 'm', p.frame_m * colorF)
  add('mullion', L('mullion', 'Steber / prečka'), m(mullionLen), 'm', p.mullion_m * colorF)
  add('sash', L('sash', 'Krila'), m(sashLen), 'm', p.sash_m * colorF)
  add('bead', L('bead', 'Steklitvene letvice'), m(beadLen), 'm', p.bead_m * colorF)
  const profileCost = lines.reduce((a, l) => a + l.total, 0)
  add('glass', L('glass', 'Steklo'), glassArea, 'm²', s.glass_m2 + (opts.glassExtraM2 ?? 0))
  for (const [k, v] of Object.entries(hw)) add('hw_' + k, L('hw_' + k, 'Okovje ' + k), v.n, 'kos', v.total / v.n)
  add('labour', L('labour', 'Delo'), 1, 'kos', s.labour_window + sashes * s.labour_sash)

  const cost = lines.reduce((a, l) => a + l.total, 0)
  return {
    lines, profileCost: r2(profileCost), cost: r2(cost), price: r2(cost * (1 + s.margin_pct / 100)),
    frameLen, sashLen, mullionLen, beadLen, glassArea: r2(glassArea), sashes,
  }
}

/** Fill missing values (older companies / partial settings). */
export function pricingFrom(raw: unknown): PricingSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<PricingSettings>
  const of = (o.offer ?? {}) as Partial<Offer>
  return {
    ...DEFAULT_PRICING, ...o, hw: { ...DEFAULT_PRICING.hw, ...(o.hw ?? {}) }, hw_m: { ...DEFAULT_PRICING.hw_m, ...(o.hw_m ?? {}) },
    offer: { ...DEFAULT_OFFER, ...of, openings: { ...DEFAULT_OFFER.openings, ...(of.openings ?? {}) } },
  }
}

// ─── Window built from sashes (configurator) ─────────────────
export type Band = 'none' | 'single' | 'split'
export interface WindowSpec {
  /** 'sliding' = sliding window (drsno okno): sashes slide instead of opening */
  kind?: 'sliding'
  sashes: number
  top: Band
  bottom: Band
  topRatio: number
  bottomRatio: number
  main: Field[]
  topFields: Field[]
  bottomFields: Field[]
}

/** Hinge the customer expects by default: left half hinged left, right half hinged right. */
export const defaultHinge = (i: number, n: number): Hinge => (i < n / 2 ? 'left' : 'right')

export function makeSpec(sashes: number, top: Band = 'none', bottom: Band = 'none', open: Opening = 'tilt_turn'): WindowSpec {
  const band = (b: Band) => (b === 'none' ? [] : b === 'single' ? [{ opening: 'fixed' as const }] : Array.from({ length: sashes }, () => ({ opening: 'fixed' as const })))
  return {
    sashes, top, bottom, topRatio: 0.28, bottomRatio: 0.28,
    main: Array.from({ length: sashes }, (_, i) => ({ opening: open, hinge: defaultHinge(i, sashes) })),
    topFields: band(top), bottomFields: band(bottom),
  }
}

/** Change the frame of the window (sashes / bands) and keep the openings where possible. */
export function reshapeSpec(old: WindowSpec, sashes: number, top: Band, bottom: Band): WindowSpec {
  const next = makeSpec(sashes, top, bottom)
  if (old.sashes === sashes) next.main = old.main
  if (old.top === top) next.topFields = old.topFields
  if (old.bottom === bottom) next.bottomFields = old.bottomFields
  next.topRatio = old.topRatio; next.bottomRatio = old.bottomRatio
  return next
}

export function specToLayout(sp: WindowSpec): Layout {
  return {
    cols: sp.main,
    mullions: sp.main.slice(1).map((f, i) => f.opening !== 'passive' && sp.main[i].opening !== 'passive'),
    top: sp.top === 'none' ? null : { fields: sp.topFields, ratio: sp.topRatio },
    bottom: sp.bottom === 'none' ? null : { fields: sp.bottomFields, ratio: sp.bottomRatio },
  }
}

/** Openings a main sash can cycle through (filtered by what the supplier offers). */
export function sashChoices(offer: Offer, sashes = 2): Field[] {
  const out: Field[] = [{ opening: 'fixed' }]
  if (offer.openings.tilt_turn) out.push({ opening: 'tilt_turn', hinge: 'left' }, { opening: 'tilt_turn', hinge: 'right' })
  if (offer.openings.turn) out.push({ opening: 'turn', hinge: 'left' }, { opening: 'turn', hinge: 'right' })
  if (offer.openings.tilt) out.push({ opening: 'tilt' })
  if (offer.openings.passive && sashes > 1) out.push({ opening: 'passive', hinge: 'left' }, { opening: 'passive', hinge: 'right' })
  return out
}
/** Top lights / bottom panels: fixed or tilt only. */
export const bandChoices = (offer: Offer): Field[] => [{ opening: 'fixed' }, ...(offer.openings.tilt ? [{ opening: 'tilt' as const }] : [])]

export const sameField = (a: Field, b: Field) => a.opening === b.opening && (a.opening === 'fixed' || a.opening === 'tilt' || a.hinge === b.hinge)
export function nextChoice(f: Field, choices: Field[]): Field {
  const i = choices.findIndex(c => sameField(c, f))
  return choices[(i + 1) % choices.length]
}

/**
 * Every opening combination for simple windows (1–3 sashes, no top light / bottom panel),
 * shown as cards. Hinges follow the position, like the competitors show them.
 */
export function simpleCombos(sashes: number, offer: Offer): Field[][] {
  // 1 sash: fixed, tilt & turn left / right, tilt only (+ turn only)
  // 2 sashes: fixed / tilt & turn / turn only on each, but not two turn-only sashes
  // 3 sashes: fixed / tilt & turn on each, the middle one may also be turn only
  const per = (i: number): Field[] => {
    const h = defaultHinge(i, sashes)
    const list: Field[] = [{ opening: 'fixed' }]
    if (offer.openings.tilt_turn) list.push({ opening: 'tilt_turn', hinge: h })
    if (sashes === 1) {
      if (offer.openings.tilt_turn) list.push({ opening: 'tilt_turn', hinge: h === 'left' ? 'right' : 'left' })
      if (offer.openings.tilt) list.push({ opening: 'tilt' })
      if (offer.openings.turn) list.push({ opening: 'turn', hinge: 'left' }, { opening: 'turn', hinge: 'right' })
    }
    if (sashes === 2 && offer.openings.turn) list.push({ opening: 'turn', hinge: h })
    if (sashes === 3 && i === 1 && offer.openings.turn) list.push({ opening: 'turn', hinge: 'left' })
    return list
  }
  let combos: Field[][] = [[]]
  for (let i = 0; i < sashes; i++) combos = combos.flatMap(c => per(i).map(f => [...c, f]))
  if (sashes === 2) combos = combos.filter(c => c.filter(f => f.opening === 'turn').length <= 1)
  // two sashes without a mullion: passive sash + tilt & turn sash
  if (sashes === 2 && offer.openings.passive && offer.openings.tilt_turn) combos.push(
    [{ opening: 'passive', hinge: 'left' }, { opening: 'tilt_turn', hinge: 'right' }],
    [{ opening: 'tilt_turn', hinge: 'left' }, { opening: 'passive', hinge: 'right' }],
  )
  // three sashes: a passive + tilt & turn pair without a mullion next to a fixed or tilt & turn sash
  if (sashes === 3 && offer.openings.passive && offer.openings.tilt_turn) combos.push(
    [{ opening: 'passive', hinge: 'left' }, { opening: 'tilt_turn', hinge: 'right' }, { opening: 'fixed' }],
    [{ opening: 'fixed' }, { opening: 'tilt_turn', hinge: 'left' }, { opening: 'passive', hinge: 'right' }],
    [{ opening: 'passive', hinge: 'left' }, { opening: 'tilt_turn', hinge: 'right' }, { opening: 'tilt_turn', hinge: 'right' }],
    [{ opening: 'tilt_turn', hinge: 'left' }, { opening: 'tilt_turn', hinge: 'left' }, { opening: 'passive', hinge: 'right' }],
  )
  return combos
}

/** Sliding window: two sashes, one or both slide (the hinge field holds the slide direction). */
export function makeSlidingSpec(): WindowSpec {
  return { ...makeSpec(2), kind: 'sliding', main: [{ opening: 'fixed' }, { opening: 'slide_window', hinge: 'left' }] }
}
export function slidingCombos(): Field[][] {
  return [
    [{ opening: 'fixed' }, { opening: 'slide_window', hinge: 'left' }],
    [{ opening: 'slide_window', hinge: 'right' }, { opening: 'fixed' }],
    [{ opening: 'slide_window', hinge: 'right' }, { opening: 'slide_window', hinge: 'left' }],
  ]
}
export const comboGroup = (sp: Pick<WindowSpec, 'kind' | 'sashes'>) => (sp.kind === 'sliding' ? 's' + sp.sashes : String(sp.sashes))

export const comboKey = (c: Field[]) => c.map(f => f.opening + (f.opening === 'fixed' || f.opening === 'tilt' ? '' : ':' + (f.hinge ?? 'left'))).join('|')

/** Every opening combination for n sashes (main row), the list the supplier ticks in the price list. */
export function allCombos(n: number, offer: Offer, kind?: 'sliding'): Field[][] {
  if (kind === 'sliding') return slidingCombos()
  // the supplier ticks combinations per window type, so every opening is listed here
  offer = { ...offer, openings: { tilt: true, turn: true, tilt_turn: true, passive: true } }
  if (n <= 3) return simpleCombos(n, offer)
  // 4 sashes: fixed / tilt & turn on each sash
  let combos: Field[][] = [[]]
  for (let i = 0; i < n; i++) combos = combos.flatMap(c => [{ opening: 'fixed' as const }, ...(offer.openings.tilt_turn ? [{ opening: 'tilt_turn' as const, hinge: defaultHinge(i, n) }] : [])].map(f => [...c, f]))
  return combos
}
/** Combinations shown to customers: the ones the supplier ticked. */
export function allowedCombos(n: number, offer: Offer, kind?: 'sliding'): Field[][] {
  const pick = offer.combos?.[comboGroup({ kind, sashes: n })]
  return allCombos(n, offer, kind).filter(c => !pick || pick.includes(comboKey(c)))
}

export const BAND_KEYS = ['none', 'top', 'topSplit', 'bottom', 'bottomSplit'] as const
export type BandKey = typeof BAND_KEYS[number]
export const BAND_SHAPE: Record<BandKey, [Band, Band]> = {
  none: ['none', 'none'], top: ['single', 'none'], topSplit: ['split', 'none'], bottom: ['none', 'single'], bottomSplit: ['none', 'split'],
}
export const bandKeyOf = (sp: Pick<WindowSpec, 'top' | 'bottom'>): BandKey =>
  (BAND_KEYS.find(k => BAND_SHAPE[k][0] === sp.top && BAND_SHAPE[k][1] === sp.bottom) ?? 'none')
/** Top light / bottom panel variants the supplier ticked for n sashes. */
export function allowedBands(n: number, offer: Offer): BandKey[] {
  const pick = offer.bands?.[String(n)]
  return BAND_KEYS.filter(k => !pick || pick.includes(k))
}

export type BandMode = 'fixed' | 'tilt'
/** Fixed and / or tilt for a top light / bottom panel variant of n sashes. */
export function allowedBandModes(n: number, band: BandKey, offer: Offer): BandMode[] {
  if (band === 'none') return []
  const pick = offer.bandModes?.[`${n}:${band}`]
  return (['fixed', 'tilt'] as const).filter(m => !pick || pick.includes(m))
}
/** The spec with every top light / bottom panel field set to one mode. */
export function withBandMode(sp: WindowSpec, mode: BandMode): WindowSpec {
  const f: Field = { opening: mode }
  return { ...sp, topFields: sp.topFields.map(() => f), bottomFields: sp.bottomFields.map(() => f) }
}
export const bandModeOf = (sp: WindowSpec): BandMode | null => {
  const all = [...sp.topFields, ...sp.bottomFields]
  return all.length ? (all.every(f => f.opening === 'tilt') ? 'tilt' : 'fixed') : null
}

/** Quick presets for bigger windows (4 sashes or with top light / bottom panel). */
export function presets(sp: WindowSpec): { key: string; main: Field[] }[] {
  const n = sp.sashes
  const tt = (i: number): Field => ({ opening: 'tilt_turn', hinge: defaultHinge(i, n) })
  const fx: Field = { opening: 'fixed' }
  const list = [
    { key: 'all_open', main: Array.from({ length: n }, (_, i) => tt(i)) },
    { key: 'all_fixed', main: Array.from({ length: n }, () => fx) },
  ]
  if (n >= 3) list.splice(1, 0, { key: 'outer_open', main: Array.from({ length: n }, (_, i) => (i === 0 || i === n - 1 ? tt(i) : fx)) })
  if (n >= 2) list.splice(1, 0, { key: 'one_open', main: Array.from({ length: n }, (_, i) => (i === n - 1 ? tt(i) : fx)) })
  return list
}
