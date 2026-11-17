import { WINDOW_COLORS, encodeColor } from './colors'
import { ralHex } from './ral'
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
  /** the glazier bills every pane at least this area (m²); 0 = the real area */
  glass_min_m2?: number
  /** the glass reaches this far into the profile's rebate on every side (mm); the glazier bills the whole pane */
  glass_rebate_mm?: number
  labour_window: number
  labour_sash: number
  /** labour per metre of frame and mullions (cutting, welding …); 0 when not used */
  labour_frame_m?: number
  /** labour per metre of sash profile; 0 when not used */
  labour_sash_m?: number
  waste_pct: number
  margin_pct: number
  /** margin on the labour; the material margin when not set */
  labour_margin_pct?: number
  both_sides_pct: number
  /** what the supplier offers in the configurator */
  offer: Offer
  /** roof windows: a catalogue of models in standard sizes (purchase prices, margin is added) */
  roof?: RoofCatalog
  /** profile colours per material (key = material), with surcharges in % on the profiles */
  colors?: ColorCatalog
  /** glass packages, purchase price per m² of glass (the first one is the base glass, included in the price) */
  glass?: GlassType[]
  /** handles, purchase price per handle (the first one is the standard handle, included in the price) */
  handles?: HandleType[]
  /** yes / no extras of a window (sills, shading, safety glass …), purchase prices */
  extras?: ExtraItem[]
  /** window sills, purchase price per metre (the sill is as long as the window is wide) */
  sills?: SillType[]
  /** shading (blinds, rollers …) and insect screens, purchase prices */
  shading?: ShadingType[]
}

/** How an extra is counted on one window. */
export type ExtraUnit = 'piece' | 'sash' | 'window_m2' | 'glass_m2' | 'width' | 'perimeter'
export const EXTRA_UNITS: ExtraUnit[] = ['piece', 'sash', 'window_m2', 'glass_m2', 'width', 'perimeter']
export type ExtraGroup = 'glass' | 'sill' | 'shading' | 'other'
export const EXTRA_GROUP_KEYS: ExtraGroup[] = ['glass', 'sill', 'shading', 'other']
/** A yes / no extra (e.g. inner sill per metre of width): purchase price per unit; the margin goes on the whole window. */
export interface ExtraItem { id: string; name: string; description?: string; group: ExtraGroup; unit: ExtraUnit; cost: number }

export function sampleExtras(): ExtraItem[] {
  return [
    { id: rid(), group: 'glass', name: 'Varnostno steklo', description: 'Lepljeno steklo VSG 33.1, ob razbitju ostane v kosu.', unit: 'glass_m2', cost: 28 },
    { id: rid(), group: 'glass', name: 'Ornamentno steklo', description: 'Motno steklo za kopalnico ali stopnišče.', unit: 'glass_m2', cost: 12 },
    { id: rid(), group: 'glass', name: 'Topel rob', description: 'Distančnik iz umetne mase, manj rosenja ob robu stekla.', unit: 'perimeter', cost: 1.5 },
    { id: rid(), group: 'glass', name: 'Prečke v steklu', description: 'Dekorativne prečke med stekli.', unit: 'window_m2', cost: 20 },
    { id: rid(), group: 'sill', name: 'Notranja polica PVC', description: 'Bela, globina do 30 cm.', unit: 'width', cost: 9 },
    { id: rid(), group: 'sill', name: 'Zunanja ALU polica', description: 'Barvana, s stranskimi zaključki.', unit: 'width', cost: 14 },
    { id: rid(), group: 'shading', name: 'Komarnik', description: 'Okvirni komarnik za vsako krilo.', unit: 'sash', cost: 25 },
    { id: rid(), group: 'shading', name: 'Zunanje žaluzije', description: 'Lamele 80 mm, ročni pogon.', unit: 'window_m2', cost: 95 },
    { id: rid(), group: 'shading', name: 'Rolete', description: 'Nadometne rolete z ročnim pogonom.', unit: 'window_m2', cost: 75 },
    { id: rid(), group: 'other', name: 'Prezračevalnik v okvirju', description: 'Samodejno prezračevanje brez odpiranja okna.', unit: 'piece', cost: 18 },
  ]
}

/** A glass package (e.g. double glazing Ug 1,1): cost per m² of glass; the margin is added on the whole window. */
export interface GlassType { id: string; name: string; description?: string; ug?: number | null; layers?: number; cost_m2: number }
/** A handle: look as in lib/colors (#hex …), cost per handle; lockable = with a key. */
export interface HandleType {
  id: string; name: string; look?: string; cost: number; lockable?: boolean
  /** RAL code of the colour (e.g. "RAL 9016"), photo of the handle (public URL; missing = drawn handle) */
  code?: string; image_url?: string | null
}

/** Sashes that get a handle (a passive sash is opened from the other one, a fixed field has none). */
export const HANDLE_OPENINGS: Opening[] = ['tilt_turn', 'turn', 'tilt', 'slide_window', 'slide', 'lift_slide']

/** Sample glass packages; the others are priced relative to the base glass (default 26 €/m²). */
export function sampleGlass(base = 26): GlassType[] {
  return [
    { id: rid(), name: 'Dvoslojno steklo', description: '4/16/4, ekonomično.', ug: 1.1, layers: 2, cost_m2: base },
    { id: rid(), name: 'Dvoslojno steklo', description: '4/16/4 z argonom, boljša toplotna izolacija.', ug: 1.0, layers: 2, cost_m2: base + 4 },
    { id: rid(), name: 'Troslojno steklo', description: '4/12/4/12/4, odlična toplotna izolacija.', ug: 0.7, layers: 3, cost_m2: base + 16 },
    { id: rid(), name: 'Troslojno steklo', description: '4/14/4/14/4, najboljša izolacija in manj hrupa.', ug: 0.5, layers: 3, cost_m2: base + 26 },
  ]
}
/** Common handle colours (RAL where there is one; metallic looks for silver, titanium, stainless steel, brass). */
export const HANDLE_COLORS: { sl: string; en: string; code?: string; look: string }[] = [
  { sl: 'Bela', en: 'White', code: 'RAL 9016', look: ralHex('RAL 9016') ?? '#f1f0ea' },
  { sl: 'Srebrna', en: 'Silver', code: 'RAL 9006', look: (ralHex('RAL 9006') ?? '#a1a1a0') + '|metal' },
  { sl: 'Titan', en: 'Titanium', code: 'RAL 9007', look: (ralHex('RAL 9007') ?? '#878581') + '|metal' },
  { sl: 'Inox (nerjaveče jeklo)', en: 'Stainless steel', look: '#c4c7c8|metal' },
  { sl: 'Medenina (zlata)', en: 'Brass (gold)', look: '#b8963e|metal' },
  { sl: 'Rjava', en: 'Brown', code: 'RAL 8017', look: ralHex('RAL 8017') ?? '#45322e' },
  { sl: 'Antracit', en: 'Anthracite', code: 'RAL 7016', look: ralHex('RAL 7016') ?? '#383e42' },
  { sl: 'Črna', en: 'Black', code: 'RAL 9005', look: ralHex('RAL 9005') ?? '#0a0a0a' },
]
const hc = (sl: string) => HANDLE_COLORS.find(c => c.sl === sl)!
export function sampleHandles(): HandleType[] {
  return [
    { id: rid(), name: 'Kljuka bela', look: hc('Bela').look, code: hc('Bela').code, cost: 6 },
    { id: rid(), name: 'Kljuka srebrna', look: hc('Srebrna').look, code: hc('Srebrna').code, cost: 8 },
    { id: rid(), name: 'Kljuka rjava', look: hc('Rjava').look, code: hc('Rjava').code, cost: 8 },
    { id: rid(), name: 'Kljuka antracit', look: hc('Antracit').look, code: hc('Antracit').code, cost: 9 },
    { id: rid(), name: 'Kljuka s ključem', look: hc('Bela').look, code: hc('Bela').code, cost: 18, lockable: true },
  ]
}
/** Chosen glass / handle, or the first one (standard); null when the supplier has none. */
/** A window sill: inside (notranja) or outside (zunanja), purchase price per metre of the window width. */
export interface SillType {
  id: string; side: 'inner' | 'outer'; name: string; description?: string; cost_m: number
  /** material for the drawing (stone, pvc, wood, alu, alu_dark) and the supplier's photo (public URL; missing = drawing) */
  material?: string; image_url?: string | null
}
/** The usual window sills; every new price list starts with all of them (purchase prices per metre). */
export const STANDARD_SILLS: Omit<SillType, 'id'>[] = [
  { side: 'inner', material: 'pvc_white', name: 'PVC polica, bela', description: 'Globina do 30 cm, z zaključnimi kapami.', cost_m: 9 },
  { side: 'inner', material: 'pvc_oak', name: 'PVC polica, dekor hrast', description: 'Folija z videzom lesa, globina do 30 cm.', cost_m: 12 },
  { side: 'inner', material: 'pvc_anthracite', name: 'PVC polica, antracit', description: 'Globina do 30 cm, z zaključnimi kapami.', cost_m: 12 },
  { side: 'inner', material: 'wood_oak', name: 'Lesena polica, hrast', description: 'Masiven hrast, oljen.', cost_m: 28 },
  { side: 'inner', material: 'wood_walnut', name: 'Lesena polica, oreh', description: 'Masiven oreh, oljen.', cost_m: 34 },
  { side: 'inner', material: 'granite', name: 'Granitna polica, siva', description: 'Naravni granit, poliran rob.', cost_m: 45 },
  { side: 'inner', material: 'granite_dark', name: 'Granitna polica, temna', description: 'Naravni granit, poliran rob.', cost_m: 50 },
  { side: 'inner', material: 'marble', name: 'Marmorna polica', description: 'Bel marmor, poliran rob.', cost_m: 55 },
  { side: 'outer', material: 'alu_white', name: 'Aluminijasta polica, bela', description: 'S stranskimi zaključki in odkapnim robom.', cost_m: 11 },
  { side: 'outer', material: 'alu_silver', name: 'Aluminijasta polica, srebrna', description: 'S stranskimi zaključki in odkapnim robom.', cost_m: 12 },
  { side: 'outer', material: 'alu_anthracite', name: 'Aluminijasta polica, antracit', description: 'S stranskimi zaključki in odkapnim robom.', cost_m: 14 },
  { side: 'outer', material: 'alu_brown', name: 'Aluminijasta polica, rjava', description: 'S stranskimi zaključki in odkapnim robom.', cost_m: 14 },
  { side: 'outer', material: 'granite', name: 'Granitna polica, siva', description: 'Naravni granit z odkapnim utorom.', cost_m: 40 },
  { side: 'outer', material: 'granite_dark', name: 'Granitna polica, temna', description: 'Naravni granit z odkapnim utorom.', cost_m: 44 },
]
export function sampleSills(): SillType[] {
  return STANDARD_SILLS.map(x => ({ ...x, id: rid() }))
}
export const newSillId = () => rid()
/** Shading or insect screen. Priced per m² of the window, per opening sash or per piece (one per window). */
export type ShadingUnit = 'm2' | 'sash' | 'piece' // 'piece' only in old price lists (shown as per window)
export type ShadingIconKind = 'blinds' | 'roller' | 'pleated' | 'screen' | 'screen_roll' | 'screen_pleated' | 'none'
export interface ShadingType {
  id: string; kind: 'shade' | 'screen'; name: string; description?: string
  unit: ShadingUnit; cost: number
  /** fixed amount per piece (drive, end parts; only with 'm2'; purchase price) and the lowest SALE price of the item */
  fixed?: number; min?: number
  /** per window (only with 'm2'): price per metre of the window width (box, top rail) and of the height (side guides) */
  per_w?: number; per_h?: number
  /** shading: an insect screen can be built into its box and guides */
  allows_screen?: boolean
  /** insect screen: can be built into a shading; then only these purchase prices count (box and guides are already paid) */
  can_integrate?: boolean
  integrated?: { fixed?: number; per_w?: number; per_h?: number; cost?: number }
  /** drawing (blinds, roller, pleated, screen, screen_roll, none) and the supplier's photo */
  icon?: ShadingIconKind; image_url?: string | null
}
export const STANDARD_SHADING: Omit<ShadingType, 'id'>[] = [
  { kind: 'shade', icon: 'blinds', name: 'Zunanje žaluzije', description: 'Lamele 80 mm, ročni pogon z jermenom.', unit: 'm2', cost: 70, fixed: 60, min: 230, allows_screen: false },
  { kind: 'shade', icon: 'blinds', name: 'Zunanje žaluzije z motorjem', description: 'Lamele 80 mm, elektromotor s stikalom.', unit: 'm2', cost: 70, fixed: 180, min: 400, allows_screen: false },
  { kind: 'shade', icon: 'roller', name: 'Rolete, ročni pogon', description: 'Nadometna omarica, aluminijaste lamele.', unit: 'm2', cost: 55, fixed: 40, min: 175, allows_screen: true },
  { kind: 'shade', icon: 'roller', name: 'Rolete z motorjem', description: 'Nadometna omarica, elektromotor s stikalom.', unit: 'm2', cost: 55, fixed: 160, min: 350, allows_screen: true },
  { kind: 'shade', icon: 'pleated', name: 'Notranje plise senčilo', description: 'Na krilu, se premika gor in dol.', unit: 'sash', fixed: 25, per_h: 6, cost: 30 },
  { kind: 'screen', icon: 'screen', name: 'Okvirni komarnik', description: 'Fiksni aluminijast okvir z mrežico, na vsako krilo.', unit: 'sash', fixed: 8, per_w: 4, per_h: 4, cost: 6 },
  { kind: 'screen', icon: 'screen_roll', name: 'Rolo komarnik', description: 'Mrežica se navije v omarico. Z roleto si deli omarico in vodila.', unit: 'm2', fixed: 40, per_w: 15, per_h: 12, cost: 20, min: 130,
    can_integrate: true, integrated: { fixed: 15, cost: 20 } },
  { kind: 'screen', icon: 'screen_pleated', name: 'Plise komarnik', description: 'Zložljiva mrežica, primerna za balkonska vrata.', unit: 'm2', fixed: 80, cost: 40, min: 170 },
]
export const sampleShading = (): ShadingType[] => STANDARD_SHADING.map(x => ({ ...x, id: rid() }))
/** Chosen shading / screen (none when the id is missing or unknown). */
export const shadingOf = (s: Pick<PricingSettings, 'shading'>, kind: ShadingType['kind'], id?: string | null) =>
  id ? s.shading?.find(x => x.id === id && x.kind === kind) ?? null : null

/** Chosen sill on one side (none when the id is missing or unknown). */
export const sillOf = (s: Pick<PricingSettings, 'sills'>, side: SillType['side'], id?: string | null) =>
  id ? s.sills?.find(x => x.id === id && x.side === side) ?? null : null

export const glassOf = (s: Pick<PricingSettings, 'glass'>, id?: string | null) => s.glass?.find(g => g.id === id) ?? s.glass?.[0] ?? null
export const handleOf = (s: Pick<PricingSettings, 'handles'>, id?: string | null) => s.handles?.find(h => h.id === id) ?? s.handles?.[0] ?? null

/** A colour of the profiles: look as in lib/colors (#hex, #hex|struct, #hex|metal, wood:key), surcharge in %
 *  on the profile price when only one side is coloured and when both sides are. */
export interface ProfileColor { id: string; name: string; code?: string; look: string; one: number; both: number }
export type ColorCatalog = Record<string, ProfileColor[]>
/** Starting colours of a material (the supplier changes or removes them). */
export function sampleColors(): ProfileColor[] {
  return WINDOW_COLORS.map(c => ({ id: rid(), name: c.sl, code: c.code, look: encodeColor(c.spec), one: c.pct * 2, both: c.pct * 3 }))
}
const isColoured = (c?: ProfileColor) => !!c && ((c.one || 0) !== 0 || (c.both || 0) !== 0)
/** Colour surcharge in % on the profiles for the chosen outside / inside colour (missing = the first, usually white):
 *  one side coloured → its "one side" %, both sides coloured → the higher "both sides" %. */
export function colorPctOf(list: ProfileColor[] | undefined, outId?: string | null, inId?: string | null): number {
  if (!list?.length) return 0
  const out = list.find(c => c.id === outId) ?? list[0], inn = list.find(c => c.id === inId) ?? list[0]
  const o = isColoured(out), i = isColoured(inn)
  if (o && i) return Math.max(out.both || 0, inn.both || 0)
  if (o) return out.one || 0
  if (i) return inn.one || 0
  return 0
}

export type RoofOpening = 'center' | 'top'
export interface RoofSize { id: string; w: number; h: number; price: number }
/** Material / colour of a roof window model (e.g. natural wood, white PVC): surcharge in % on the size price */
export interface RoofVariant { id: string; name: string; pct: number }
export interface RoofModel {
  id: string; name: string; opening: RoofOpening; sizes: RoofSize[]
  /** manufacturer, e.g. Velux, Fakro, Roto */
  brand?: string
  /** short technical description shown to the customer (glazing, Uw, material …) */
  description?: string
  image_url?: string | null
  /** link to the manufacturer's technical sheet (PDF) */
  datasheet_url?: string
  variants?: RoofVariant[]
}
/** Price of a roof window: size price with the material / colour surcharge, plus the flashing. */
export function roofUnitPrice(sizePrice: number, variantPct: number, flashingPrice: number): number {
  return Math.round((sizePrice * (1 + (variantPct || 0) / 100) + (flashingPrice || 0)) * 100) / 100
}
export interface RoofFlashing { id: string; name: string; price: number }
export interface RoofCatalog { models: RoofModel[]; flashings: RoofFlashing[] }

const rid = () => Math.random().toString(36).slice(2, 9)
/** Typical roof window range (sizes in cm, illustrative sale prices excl. VAT). */
export function sampleRoofCatalog(): RoofCatalog {
  const sizes = (list: [number, number, number][]) => list.map(([w, h, price]) => ({ id: rid(), w, h, price }))
  return {
    models: [
      { id: rid(), name: 'Vrtljivo strešno okno', opening: 'center', sizes: sizes([[55, 78, 320], [66, 118, 420], [78, 118, 465], [78, 140, 505], [114, 118, 595], [114, 140, 665]]) },
      { id: rid(), name: 'Strešno okno z zgornjim vrtiščem', opening: 'top', sizes: sizes([[66, 118, 520], [78, 118, 575], [78, 140, 625], [114, 140, 810]]) },
    ],
    flashings: [
      { id: rid(), name: 'Obroba za valovito kritino (opečna, betonska)', price: 95 },
      { id: rid(), name: 'Obroba za ravno kritino (pločevina, skodle)', price: 80 },
    ],
  }
}
export const newRoofId = rid

/** Product categories and window variants the supplier offers (Cenik step 1). */
export interface Offer {
  windows: boolean
  sashes: number[]            // 1–4
  top: boolean; topSplit: boolean; bottom: boolean; bottomSplit: boolean
  openings: { tilt: boolean; turn: boolean; tilt_turn: boolean; passive: boolean }
  doors: boolean; sliding: boolean; special: boolean
  /** balcony doors (balkonska vrata): sash counts offered, built like windows */
  doorSashes?: number[]
  /** sliding walls (drsne stene, PSK): panel counts offered (2–4) */
  wallSashes?: number[]
  /** sliding windows (drsna okna) */
  slidingWindows: boolean
  /** roof windows (strešna okna) */
  roof: boolean
  /** opening combinations the supplier makes, per number of sashes (missing = all) */
  combos?: Record<string, string[]>
  /** top light / bottom panel variants per number of sashes: none, top, topSplit, bottom, bottomSplit (missing = all); balcony doors under "d1", "d2" … */
  bands?: Record<string, string[]>
  /** per window type and top light variant ("3:top"): may it be fixed and/or tilt (missing = both) */
  bandModes?: Record<string, string[]>
  /** complete variants the supplier switched OFF, per number of sashes (everything else is offered) */
  variantsOff?: Record<string, string[]>
}
export const DEFAULT_OFFER: Offer = {
  windows: true, sashes: [1, 2, 3], top: true, topSplit: true, bottom: true, bottomSplit: true,
  openings: { tilt: true, turn: true, tilt_turn: true, passive: true }, doors: true, sliding: true, special: false, slidingWindows: true, roof: true,
  doorSashes: [1, 2, 3], wallSashes: [2, 3, 4],
}

export const DEFAULT_PRICING: PricingSettings = {
  hw: { tilt_turn: 20, turn: 15, tilt: 18, passive: 10, slide_window: 40, slide: 120, lift_slide: 450 },
  hw_m: { tilt_turn: 1, turn: 1, tilt: 1, passive: 0.5, slide_window: 2, slide: 5, lift_slide: 20 },
  glass_m2: 32, glass_rebate_mm: 13, labour_window: 30, labour_sash: 22, waste_pct: 6, margin_pct: 45, both_sides_pct: 10,
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
  /** cost split: material (profiles, glass, hardware, handles, sills, shading) and labour */
  material: number
  labour: number
  /** helpful numbers for the summary */
  frameLen: number; sashLen: number; mullionLen: number; beadLen: number; glassArea: number; sashes: number
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * @param colorPct colour surcharge on the profiles (foil / powder coat), e.g. 15
 * @param glassExtraM2 surcharge of the chosen glass per m² of glass (on top of the base glass)
 * @param glassId / handleId chosen glass package and handle (missing = the first one = standard)
 */
export function costWindow(layout: Layout, W: number, H: number, p: ProfilePrices, s: PricingSettings,
  opts: { colorPct?: number; bothSides?: boolean; glassExtraM2?: number; glassId?: string | null; handleId?: string | null; extraIds?: string[] | null; sillIn?: string | null; sillOut?: string | null; shadeId?: string | null; screenId?: string | null; labels?: Partial<Record<string, string>> } = {}): Costing {
  const fw = p.frame_w ?? 70, sw = p.sash_w ?? 78, mw = p.mullion_w ?? 82
  const L = (k: string, d: string) => opts.labels?.[k] ?? d
  const cols = layout.cols
  const topH = layout.top ? Math.round(H * layout.top.ratio) : 0
  const botH = layout.bottom ? Math.round(H * layout.bottom.ratio) : 0
  const innerW = W - 2 * fw

  let mullionLen = 0, sashLen = 0, beadLen = 0, glassArea = 0, glassBill = 0, sashes = 0, handles = 0
  // every pane is billed at least the glazier's smallest area
  // the pane is larger than what you see: it reaches into the rebate on every side
  const reb = s.glass_rebate_mm ?? 13
  const pane = (gw: number, gh: number) => {
    if (gw <= 0 || gh <= 0) return
    const a = (gw + 2 * reb) * (gh + 2 * reb) / 1e6
    glassArea += a; glassBill += Math.max(a, s.glass_min_m2 ?? 0)
  }
  // sizes of the opening sashes added up (for shading / screens priced per sash)
  let sashWSum = 0, sashHSum = 0, sashArea = 0
  const hw: Record<string, { n: number; total: number }> = {}

  // a field = clear opening inside the frame / mullions
  function field(f: Field, cw: number, ch: number) {
    if (cw <= 0 || ch <= 0) return
    if (f.opening === 'fixed') {
      beadLen += 2 * (cw + ch)
      pane(cw, ch)
      return
    }
    sashes++
    if (HANDLE_OPENINGS.includes(f.opening)) handles++
    const sashW = cw + 2 * OVERLAP, sashH = ch + 2 * OVERLAP
    sashWSum += sashW; sashHSum += sashH; sashArea += sashW * sashH / 1e6
    sashLen += 2 * (sashW + sashH)
    const gw = Math.max(0, sashW - 2 * sw), gh = Math.max(0, sashH - 2 * sw)
    beadLen += 2 * (gw + gh)
    pane(gw, gh)
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
  // lines are shown rounded to cents, but the cost adds up the exact amounts (same as the server)
  let exact = 0
  const add = (key: string, label: string, qty: number, unit: CutLine['unit'], price: number) => {
    if (qty > 0) { lines.push({ key, label, qty: r2(qty), unit, price: r2(price), total: r2(qty * price) }); exact += qty * price }
  }
  add('frame', L('frame', 'Okvir'), m(frameLen), 'm', p.frame_m * colorF)
  add('mullion', L('mullion', 'Steber / prečka'), m(mullionLen), 'm', p.mullion_m * colorF)
  add('sash', L('sash', 'Krila'), m(sashLen), 'm', p.sash_m * colorF)
  add('bead', L('bead', 'Pritrdilne letvice'), m(beadLen), 'm', p.bead_m * colorF)
  const profileCost = lines.reduce((a, l) => a + l.total, 0)
  const gl = glassOf(s, opts.glassId), hd = handleOf(s, opts.handleId)
  add('glass', gl ? `${L('glass', 'Steklo')}: ${gl.name}` : L('glass', 'Steklo'), glassBill, 'm²', (gl ? gl.cost_m2 : s.glass_m2) + (opts.glassExtraM2 ?? 0))
  for (const [k, v] of Object.entries(hw)) add('hw_' + k, L('hw_' + k, 'Okovje ' + k), v.n, 'kos', v.total / v.n)
  if (hd) add('handle', `${L('handle', 'Kljuke')}: ${hd.name}`, handles, 'kos', hd.cost)
  // window sills: as long as the window is wide
  for (const sl of [sillOf(s, 'inner', opts.sillIn), sillOf(s, 'outer', opts.sillOut)]) {
    if (sl) add('sill_' + sl.side, `${L('sill_' + sl.side, sl.side === 'inner' ? 'Notranja polica' : 'Zunanja polica')}: ${sl.name}`, W / 1000, 'm', sl.cost_m)
  }
  // shading and insect screen: per window or per opening sash; a screen built into the shading's box
  // and guides only counts its own parts (integrated prices, no lowest price)
  const shade = shadingOf(s, 'shade', opts.shadeId), screenRaw = shadingOf(s, 'screen', opts.screenId)
  const screen = screenRaw && shade?.allows_screen && screenRaw.can_integrate && screenRaw.integrated
    ? { ...screenRaw, unit: 'm2' as const, fixed: screenRaw.integrated.fixed ?? 0, per_w: screenRaw.integrated.per_w ?? 0, per_h: screenRaw.integrated.per_h ?? 0, cost: screenRaw.integrated.cost ?? 0, min: 0, name: `${screenRaw.name} (${L('integrated', 'vgrajen')})` }
    : screenRaw
  for (const sh of [shade, screen]) {
    if (!sh) continue
    // per window: fixed + width × €/m + height × €/m + area × €/m² of the window;
    // per sash: the same for every opening sash (summed over the sashes' widths, heights and areas)
    const [n, w, h, a] = sh.unit === 'sash' ? [sashes, sashWSum / 1000, sashHSum / 1000, sashArea] : [1, W / 1000, H / 1000, W * H / 1e6]
    const sum = (sh.fixed ?? 0) * n + (sh.per_w ?? 0) * w + (sh.per_h ?? 0) * h + sh.cost * a
    // the lowest sale price is turned back into a cost, so the margin added to the window brings it to exactly that price
    const amount = Math.max((sh.min ?? 0) / (1 + (s.margin_pct ?? 0) / 100), sum)
    add('shade_' + sh.kind, `${L('shade_' + sh.kind, sh.kind === 'shade' ? 'Senčilo' : 'Komarnik')}: ${sh.name}`, 1, 'kos', amount)
  }
  // chosen yes / no extras, counted per window
  for (const x of s.extras ?? []) {
    if (!opts.extraIds?.includes(x.id)) continue
    const [qty, unit]: [number, CutLine['unit']] =
      x.unit === 'sash' ? [sashes, 'kos'] : x.unit === 'window_m2' ? [W * H / 1e6, 'm²'] : x.unit === 'glass_m2' ? [glassArea, 'm²']
      : x.unit === 'width' ? [W / 1000, 'm'] : x.unit === 'perimeter' ? [2 * (W + H) / 1000, 'm'] : [1, 'kos']
    add('x_' + x.id, x.name, qty, unit, x.cost)
  }
  // labour: frame (fixed per window + per metre of frame and mullions) and sashes (fixed per sash + per metre of sash profile)
  const labour = s.labour_window + (s.labour_frame_m ?? 0) * (frameLen + mullionLen) / 1000 + sashes * s.labour_sash + (s.labour_sash_m ?? 0) * sashLen / 1000
  add('labour', L('labour', 'Delo'), 1, 'kos', labour)

  const cost = exact
  // the material margin on the material, the labour margin on the labour
  const material = cost - labour
  const price = material * (1 + s.margin_pct / 100) + labour * (1 + (s.labour_margin_pct ?? s.margin_pct) / 100)
  return {
    lines, profileCost: r2(profileCost), cost: r2(cost), price: r2(price), material: r2(material), labour: r2(labour),
    frameLen, sashLen, mullionLen, beadLen, glassArea: r2(glassArea), sashes,
  }
}

/** Fill missing values (older companies / partial settings). */
export function pricingFrom(raw: unknown): PricingSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<PricingSettings>
  const of = (o.offer ?? {}) as Partial<Offer>
  return {
    ...DEFAULT_PRICING, ...o, hw: { ...DEFAULT_PRICING.hw, ...(o.hw ?? {}) }, hw_m: { ...DEFAULT_PRICING.hw_m, ...(o.hw_m ?? {}) },
    // windows go up to three sashes (older saved offers may still list 4)
    offer: { ...DEFAULT_OFFER, ...of, sashes: (of.sashes ?? DEFAULT_OFFER.sashes).filter(n => n >= 1 && n <= 3), openings: { ...DEFAULT_OFFER.openings, ...(of.openings ?? {}) } },
  }
}

// ─── Window built from sashes (configurator) ─────────────────
export type Band = 'none' | 'single' | 'split'
export interface WindowSpec {
  /** 'sliding' = sliding window (drsno okno): sashes slide instead of opening; 'door' = balcony door (balkonska vrata) */
  kind?: 'sliding' | 'door' | 'wall'
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
  if (old.kind) next.kind = old.kind
  return next
}

/** Two neighbouring sashes without a mullion: a passive sash and the sash it closes against. A passive sash
 *  hinged left meets the sash on its right, one hinged right the sash on its left (no hinge: either side). */
export const meetsWithoutMullion = (a: Field, b: Field) =>
  (a.opening === 'passive' && a.hinge !== 'right') || (b.opening === 'passive' && b.hinge !== 'left')

const isSlide = (f: Field) => f.opening === 'slide_window' || f.opening === 'slide'

export function specToLayout(sp: WindowSpec): Layout {
  return {
    cols: sp.main,
    mullions: sp.main.slice(1).map((f, i) => !meetsWithoutMullion(sp.main[i], f) && !isSlide(f) && !isSlide(sp.main[i])),
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
      // fixed, tilt & turn (both hands), turn only (both hands, same order), tilt only last
      const other = h === 'left' ? 'right' : 'left'
      if (offer.openings.tilt_turn) list.push({ opening: 'tilt_turn', hinge: other })
      if (offer.openings.turn) list.push({ opening: 'turn', hinge: h }, { opening: 'turn', hinge: other })
      if (offer.openings.tilt) list.push({ opening: 'tilt' })
    }
    if (sashes === 2 && offer.openings.turn) list.push({ opening: 'turn', hinge: h })
    if (sashes === 3 && i === 1 && offer.openings.turn) list.push({ opening: 'turn', hinge: 'left' })
    return list
  }
  let combos: Field[][] = [[]]
  if (sashes === 2) {
    // Every sash opens to its own side. The mullion (part of the frame) is only there where it is
    // really needed: next to fixed glass, and when both sashes tilt. A turn-only sash next to an
    // opening sash is the passive sash of a window without a mullion (its meeting stile is part of the sash).
    const F: Field = { opening: 'fixed' }
    const K = (i: number): Field => ({ opening: 'tilt_turn', hinge: defaultHinge(i, 2) })
    const O = (i: number): Field => ({ opening: 'turn', hinge: defaultHinge(i, 2) })
    const P = (i: number): Field => ({ opening: 'passive', hinge: defaultHinge(i, 2) })
    combos = [[F, F], [F, K(1)], [K(0), F], [F, O(1)], [O(0), F], [K(0), K(1)], [P(0), K(1)], [K(0), P(1)], [P(0), O(1)]]
      .filter(c => c.every(f => f.opening === 'fixed' || offer.openings[f.opening as 'tilt_turn' | 'turn' | 'passive']))
  } else if (sashes === 3) {
    // the 14 the competitors show; a turn-only middle sash is the passive half of a pair without a mullion
    // (passive hinged left meets the sash on its right, hinged right meets the one on its left)
    const F: Field = { opening: 'fixed' }
    const KL: Field = { opening: 'tilt_turn', hinge: 'left' }, KR: Field = { opening: 'tilt_turn', hinge: 'right' }
    const PL: Field = { opening: 'passive', hinge: 'left' }, PR: Field = { opening: 'passive', hinge: 'right' }
    combos = [[F, F, F], [F, F, KR], [F, KL, F], [KL, F, F], [F, KR, F], [F, PL, KR], [F, KL, KR], [KL, PR, F], [KL, KR, F],
      [KL, F, KR], [KL, PR, KR], [KL, PL, KR], [KL, KL, KR], [KL, KR, KR]]
      .filter(c => c.every(f => f.opening === 'fixed' || offer.openings[f.opening as 'tilt_turn' | 'passive']))
  } else {
    for (let i = 0; i < sashes; i++) combos = combos.flatMap(c => per(i).map(f => [...c, f]))
  }
  return combos
}

/** Balcony door of n sashes: built like a window, drawn and sized as a door. */
export function makeDoorSpec(sashes: number, top: Band = 'none'): WindowSpec {
  return { ...makeSpec(sashes, top), kind: 'door' }
}
export type BuilderKind = 'door' | undefined
/** Key of a window / balcony door type in offer.bands and offer.variantsOff. */
export const offerKey = (n: number, kind?: BuilderKind | 'sliding') => (kind === 'door' ? 'd' + n : String(n))

/** Product groups a profile can be used for (Cenik step 3). Roof windows are a catalogue without profiles. */
export const PRODUCT_GROUPS = ['windows', 'slidingWindows', 'doors', 'walls'] as const
export type ProductGroup = typeof PRODUCT_GROUPS[number]
export const productGroupOf = (kind?: WindowSpec['kind']): ProductGroup =>
  kind === 'sliding' ? 'slidingWindows' : kind === 'door' ? 'doors' : kind === 'wall' ? 'walls' : 'windows'
/** Does a profile serve this product group? (no list = every group) */
export const profileServes = (appliesTo: string[] | null | undefined, g: ProductGroup) => !appliesTo || appliesTo.includes(g)

/** Sliding wall (PSK) of n panels; the sliding panel tilts too. */
export function makeWallSpec(n: number): WindowSpec {
  return { ...makeSpec(n), kind: 'wall', main: wallCombos(n)[0] }
}
/** Sliding walls, like the competitors: one or two panels slide (hinge holds the direction), the rest is fixed. */
export function wallCombos(n: number): Field[][] {
  const F: Field = { opening: 'fixed' }, L: Field = { opening: 'slide', hinge: 'left' }, R: Field = { opening: 'slide', hinge: 'right' }
  if (n === 2) return [[F, L], [R, F]]
  if (n === 3) return [[F, L, F], [F, R, F]]
  return [[F, L, F, F], [F, F, R, F], [F, L, R, F]]
}

/** Sliding window: two sashes, one or both slide (the hinge field holds the slide direction). */
export function makeSlidingSpec(): WindowSpec {
  return { ...makeSpec(2), kind: 'sliding', main: [{ opening: 'fixed' }, { opening: 'slide_window', hinge: 'left' }] }
}
export function slidingCombos(): Field[][] {
  // like the competitors: left sash slides right, right sash slides left, both slide
  return [
    [{ opening: 'slide_window', hinge: 'right' }, { opening: 'fixed' }],
    [{ opening: 'fixed' }, { opening: 'slide_window', hinge: 'left' }],
    [{ opening: 'slide_window', hinge: 'right' }, { opening: 'slide_window', hinge: 'left' }],
  ]
}
export const comboGroup = (sp: Pick<WindowSpec, 'kind' | 'sashes'>) => (sp.kind === 'sliding' ? 's' + sp.sashes : sp.kind === 'wall' ? 'w' + sp.sashes : offerKey(sp.sashes, sp.kind as BuilderKind))

export const comboKey = (c: Field[]) => c.map(f => f.opening + (f.opening === 'fixed' || f.opening === 'tilt' ? '' : ':' + (f.hinge ?? 'left'))).join('|')

/** Balcony doors, like the competitors offer them:
 *  1 sash: fixed, tilt & turn (both hands), turn (both hands);
 *  2 sashes: fixed / tilt & turn, or a tilt & turn sash with a passive one (no mullion);
 *  3 sashes: the same 14 as windows. */
export function doorCombos(n: number, offer: Offer): Field[][] {
  if (n === 1) {
    const F: Field = { opening: 'fixed' }
    return [F, { opening: 'tilt_turn', hinge: 'left' }, { opening: 'tilt_turn', hinge: 'right' }, { opening: 'turn', hinge: 'left' }, { opening: 'turn', hinge: 'right' }].map(f => [f as Field])
  }
  if (n === 2) {
    const F: Field = { opening: 'fixed' }
    const KL: Field = { opening: 'tilt_turn', hinge: 'left' }, KR: Field = { opening: 'tilt_turn', hinge: 'right' }
    const PL: Field = { opening: 'passive', hinge: 'left' }, PR: Field = { opening: 'passive', hinge: 'right' }
    return [[F, F], [F, KR], [KL, F], [PL, KR], [KL, PR], [KL, KR]]
      .filter(c => c.every(f => f.opening === 'fixed' || offer.openings[f.opening as 'tilt_turn' | 'passive']))
  }
  return allCombos(n, offer).filter(c => !c.some(f => f.opening === 'tilt'))
}

/** Every opening combination for n sashes (main row), the list the supplier ticks in the price list. */
export function allCombos(n: number, offer: Offer, kind?: 'sliding' | 'wall'): Field[][] {
  if (kind === 'sliding') return slidingCombos()
  if (kind === 'wall') return wallCombos(n)
  // the supplier ticks combinations per window type, so every opening is listed here
  offer = { ...offer, openings: { tilt: true, turn: true, tilt_turn: true, passive: true } }
  if (n <= 3) return simpleCombos(n, offer)
  // 4 sashes: fixed / tilt & turn on each sash
  let combos: Field[][] = [[]]
  for (let i = 0; i < n; i++) combos = combos.flatMap(c => [{ opening: 'fixed' as const }, ...(offer.openings.tilt_turn ? [{ opening: 'tilt_turn' as const, hinge: defaultHinge(i, n) }] : [])].map(f => [...c, f]))
  return combos
}
/** Combinations shown to customers: the ones the supplier ticked. */
export function allowedCombos(n: number, offer: Offer, kind?: 'sliding' | 'wall'): Field[][] {
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
/** Top light / bottom panel shapes that exist for n sashes: a single sash has nothing to split;
 *  a balcony door has only a whole top light (no bottom part: the threshold is there). */
export const bandKeysFor = (n: number, kind?: BuilderKind): BandKey[] =>
  kind === 'door' ? ['none', 'top'] : n === 1 ? ['none', 'top', 'bottom'] : [...BAND_KEYS]
/** Top light / bottom panel variants the supplier ticked for n sashes. */
export function allowedBands(n: number, offer: Offer, kind?: BuilderKind): BandKey[] {
  const pick = offer.bands?.[offerKey(n, kind)]
  return bandKeysFor(n, kind).filter(k => !pick || pick.includes(k))
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

export interface Variant { key: string; band: BandKey; mode: BandMode | null; combo: Field[] }
export const variantKey = (band: BandKey, mode: BandMode | null, combo: Field[]) => `${band}${mode ? ':' + mode : ''}#${comboKey(combo)}`

/**
 * With a top light / bottom part only the usual combinations, like the competitors offer them:
 * 1 sash: fixed or tilt & turn (both hands) under a fixed one; fixed, tilt or tilt & turn (both hands) under a tilting one.
 * 2 sashes: no turn-only sash (fixed / tilt & turn, or tilt & turn with a passive sash).
 * Split above / below every sash: the dividing profile carries on as a mullion, so no passive sash.
 */
function withBandOk(n: number, mode: BandMode | null, combo: Field[], band: BandKey = 'none', kind?: BuilderKind): boolean {
  if (!mode) return true
  // balcony door of one sash under a top light: fixed or tilt & turn (both hands)
  if (kind === 'door' && n === 1) return combo[0].opening === 'fixed' || combo[0].opening === 'tilt_turn'
  if ((band === 'topSplit' || band === 'bottomSplit') && combo.some(f => f.opening === 'passive')) return false
  // a whole (not split) bottom part is always fixed
  if (band === 'bottom' && mode === 'tilt') return false
  if (n === 1) {
    const o = combo[0]
    if (mode === 'fixed') return o.opening === 'fixed' || o.opening === 'tilt_turn'
    return o.opening === 'fixed' || o.opening === 'tilt' || o.opening === 'tilt_turn'
  }
  if (n === 2) return !combo.some(f => f.opening === 'turn')
  if (n === 3) {
    // a whole (not split) bottom part is only fixed; under a whole top light / bottom part two neighbouring
    // tilt & turn sashes always come as a pair with a passive sash
    if (band === 'bottom' && mode === 'tilt') return false
    if (band === 'top' || band === 'bottom') return !combo.some((f, i) => i > 0 && f.opening === 'tilt_turn' && combo[i - 1].opening === 'tilt_turn')
  }
  return true
}

/** Every complete window of n sashes the supplier makes: ticked top light variants × fixed / tilt × all sash combinations. */
export function allVariants(n: number, offer: Offer, kind?: BuilderKind): Variant[] {
  const combos = kind === 'door' ? doorCombos(n, offer) : allCombos(n, offer)
  return allowedBands(n, offer, kind).flatMap(band => {
    const modes: (BandMode | null)[] = band === 'none' ? [null] : ['fixed', 'tilt']
    return modes.flatMap(mode => combos.filter(combo => withBandOk(n, mode, combo, band, kind)).map(combo => ({ key: variantKey(band, mode, combo), band, mode, combo })))
  })
}
/** The variants customers can choose (the supplier did not switch them off). */
export function allowedVariants(n: number, offer: Offer, kind?: BuilderKind): Variant[] {
  const off = offer.variantsOff?.[offerKey(n, kind)] ?? []
  return allVariants(n, offer, kind).filter(v => !off.includes(v.key))
}
export const specVariantKey = (sp: WindowSpec) => variantKey(bandKeyOf(sp), bandModeOf(sp), sp.main)
export function applyVariant(sp: WindowSpec, v: Variant): WindowSpec {
  const shaped = reshapeSpec(sp, sp.sashes, ...BAND_SHAPE[v.band])
  const withMain = { ...shaped, main: v.combo }
  return v.mode ? withBandMode(withMain, v.mode) : withMain
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

/** Labels of the cut list lines (internal costing view). */
export const CALC_LABELS = {
  sl: { frame: 'Okvir', mullion: 'Steber / prečka', sash: 'Krila', bead: 'Pritrdilne letvice', glass: 'Steklo', handle: 'Kljuke', labour: 'Delo',
    hw_tilt_turn: 'Okovje odpiranje in kip', hw_turn: 'Okovje odpiranje', hw_tilt: 'Okovje kip', hw_passive: 'Okovje pasivno krilo', hw_slide_window: 'Okovje drsno okno', hw_slide: 'Okovje drsno', hw_lift_slide: 'Okovje dvižno-drsno', sill_inner: 'Notranja polica', sill_outer: 'Zunanja polica', shade_shade: 'Senčilo', shade_screen: 'Komarnik', integrated: 'vgrajen' },
  en: { frame: 'Frame', mullion: 'Mullion / transom', sash: 'Sashes', bead: 'Glazing beads', glass: 'Glass', handle: 'Handles', labour: 'Labour',
    hw_tilt_turn: 'Hardware tilt & turn', hw_turn: 'Hardware turn', hw_tilt: 'Hardware tilt', hw_passive: 'Hardware passive sash', hw_slide_window: 'Hardware sliding window', hw_slide: 'Hardware sliding', hw_lift_slide: 'Hardware lift & slide', sill_inner: 'Inner sill', sill_outer: 'Outer sill', shade_shade: 'Shading', shade_screen: 'Insect screen', integrated: 'built in' },
}
