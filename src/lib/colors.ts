// Window colours: a colour option stores its look in window_options.description as
//   "#rrggbb"                 smooth (gladka)
//   "#rrggbb|struct"          structured / matt (struktura)
//   "#rrggbb|metal"           metallic
//   "wood:<key>"              wood-grain foil (hex comes from WOODS)
// Plain "#rrggbb" stays valid, so older colours keep working.

export type Finish = 'smooth' | 'struct' | 'metal' | 'wood'
export type WoodKey = 'golden_oak' | 'walnut' | 'mahogany' | 'dark_oak' | 'winchester' | 'douglas' | 'light_oak'
export interface ColorSpec { hex: string; finish: Finish; wood?: WoodKey }

export const WOODS: Record<WoodKey, { hex: string; grain: string; sl: string; en: string }> = {
  golden_oak: { hex: '#b8742f', grain: '#8a4f1a', sl: 'Zlati hrast', en: 'Golden oak' },
  walnut:     { hex: '#6a4428', grain: '#45291a', sl: 'Oreh', en: 'Walnut' },
  mahogany:   { hex: '#7a3322', grain: '#521d12', sl: 'Mahagonij', en: 'Mahogany' },
  dark_oak:   { hex: '#5a3d27', grain: '#3a2617', sl: 'Temni hrast', en: 'Dark oak' },
  winchester: { hex: '#a5683a', grain: '#7a4521', sl: 'Winchester', en: 'Winchester' },
  douglas:    { hex: '#c98d55', grain: '#9c6233', sl: 'Duglazija', en: 'Douglas fir' },
  light_oak:  { hex: '#d6b88e', grain: '#ab8a5e', sl: 'Svetli hrast', en: 'Light oak' },
}

export function parseColor(desc: string | null | undefined): ColorSpec | null {
  if (!desc) return null
  const v = desc.trim()
  if (v.startsWith('wood:')) {
    const key = v.slice(5) as WoodKey
    return WOODS[key] ? { hex: WOODS[key].hex, finish: 'wood', wood: key } : null
  }
  const m = /^(#[0-9a-f]{6})(?:\|(struct|metal|smooth))?$/i.exec(v)
  return m ? { hex: m[1].toLowerCase(), finish: (m[2] as Finish | undefined) ?? 'smooth' } : null
}

export function encodeColor(c: ColorSpec): string {
  if (c.finish === 'wood' && c.wood) return `wood:${c.wood}`
  return c.finish === 'smooth' ? c.hex : `${c.hex}|${c.finish}`
}

/** Hex used for the window drawing frame. */
export const colorHex = (desc: string | null | undefined) => parseColor(desc)?.hex ?? null

export interface ColorPreset { sl: string; en: string; code?: string; spec: ColorSpec; pct: number }

// Colours window suppliers usually offer (RAL codes for solid colours, foils for wood).
// pct = a typical surcharge in % of the window price; the supplier can change it.
export const WINDOW_COLORS: ColorPreset[] = [
  { sl: 'Bela', en: 'White', code: 'RAL 9016', spec: { hex: '#f3f3ee', finish: 'smooth' }, pct: 0 },
  { sl: 'Kremno bela', en: 'Cream white', code: 'RAL 9001', spec: { hex: '#e9e0cf', finish: 'smooth' }, pct: 12 },
  { sl: 'Svetlo siva', en: 'Light grey', code: 'RAL 7035', spec: { hex: '#c9cec9', finish: 'struct' }, pct: 15 },
  { sl: 'Ahatno siva', en: 'Agate grey', code: 'RAL 7038', spec: { hex: '#b3b6ae', finish: 'struct' }, pct: 15 },
  { sl: 'Kvarčno siva', en: 'Quartz grey', code: 'RAL 7039', spec: { hex: '#6b685e', finish: 'struct' }, pct: 15 },
  { sl: 'Bazaltno siva', en: 'Basalt grey', code: 'RAL 7012', spec: { hex: '#4f5653', finish: 'struct' }, pct: 15 },
  { sl: 'Antracit', en: 'Anthracite', code: 'RAL 7016', spec: { hex: '#383e42', finish: 'struct' }, pct: 15 },
  { sl: 'Antracit gladek', en: 'Anthracite smooth', code: 'RAL 7016', spec: { hex: '#383e42', finish: 'smooth' }, pct: 15 },
  { sl: 'Črna', en: 'Black', code: 'RAL 9005', spec: { hex: '#151517', finish: 'struct' }, pct: 18 },
  { sl: 'Sepia rjava', en: 'Sepia brown', code: 'RAL 8014', spec: { hex: '#4a3727', finish: 'struct' }, pct: 15 },
  { sl: 'Mahovo zelena', en: 'Moss green', code: 'RAL 6005', spec: { hex: '#16443a', finish: 'smooth' }, pct: 18 },
  { sl: 'Jeklено modra', en: 'Steel blue', code: 'RAL 5011', spec: { hex: '#1d2b3a', finish: 'smooth' }, pct: 18 },
  { sl: 'Vinsko rdeča', en: 'Wine red', code: 'RAL 3005', spec: { hex: '#5b1a22', finish: 'smooth' }, pct: 18 },
  { sl: 'Krtačeni aluminij', en: 'Brushed aluminium', code: 'Alux', spec: { hex: '#a9abab', finish: 'metal' }, pct: 25 },
  { sl: 'Antracit metalik', en: 'Anthracite metallic', code: 'DB 703', spec: { hex: '#4a4d52', finish: 'metal' }, pct: 25 },
  ...(Object.keys(WOODS) as WoodKey[]).map(k => ({ sl: WOODS[k].sl, en: WOODS[k].en, code: 'folija', spec: { hex: WOODS[k].hex, finish: 'wood' as const, wood: k }, pct: 18 })),
]
