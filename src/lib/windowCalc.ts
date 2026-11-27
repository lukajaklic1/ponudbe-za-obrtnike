// The open calculation of a window in a quote: every cost line, the margin and how the sale price comes out.
// It uses the supplier's own price list (purchase prices and margins), the same costing as the configurator,
// so the figures here add up to the price on the quote line.
import { costWindow, specToLayout, colorPctOf, pricingFrom, roofUnitPrice, type CutLine, type PricingSettings } from './costing'
import type { ConfigItem } from '../pages/ConfiguratorPage'

/** the profile as stored in the price list (purchase prices per metre, visible widths, lowest price) */
export interface RawSystem {
  id: string; name: string; material: string
  frame_m?: number | null; sash_m?: number | null; mullion_m?: number | null; bead_m?: number | null
  frame_w?: number | null; sash_w?: number | null; mullion_w?: number | null
  min_price?: number | null
}

export interface WindowCalc {
  kind: 'window' | 'roof'
  /** the cost lines: profile, glass, hardware, handles, sills, shading, extras, labour (purchase prices); a roof window: model, variant, flashing */
  lines: CutLine[]
  /** purchase value of material and labour, and together */
  material: number; labour: number; cost: number
  materialMarginPct: number; labourMarginPct: number
  /** margin in money: sale price of the window with everything minus the purchase value */
  margin: number
  /** sale price per piece: the window alone and the additions on top of it (better glass, sills, shading …) */
  windowAlone: number; additions: number; unitPrice: number
  /** the profile's lowest price: set when it is higher than the calculated price of the window alone */
  minPrice: number; minApplied: boolean; calculatedAlone: number
  colorPct: number
  system: string
}

const r2 = (n: number) => Math.round(n * 100) / 100

const LABELS_EN: Record<string, string> = {
  frame: 'Frame', mullion: 'Mullion / transom', sash: 'Sashes', bead: 'Glazing beads', glass: 'Glass', handle: 'Handles', labour: 'Labour',
  sill_inner: 'Inside sill', sill_outer: 'Outside sill', shade_shade: 'Shading', shade_screen: 'Insect screen',
  // the words inside the explanation of a line
  waste: 'waste', colourPrice: 'price with the colour surcharge', rebate: 'the pane reaches ${reb} mm into the rebate on every side',
  glassMin: 'smallest billed pane', perSash: 'sash perimeter', perHandle: 'one handle per opening sash',
  sillWidth: 'window width', shadeMin: 'the lowest price applies', asCost: 'as cost',
  perSashShort: 'per opening sash', glassArea: 'glass area', perWindow: 'per window',
  frameAndBars: 'frame and bars', sashProfile: 'sash profile', perField: 'fixed field', perBar: 'transom / mullion',
}

/** one window (built from sashes): the same numbers as the configurator's price, with the purchase prices opened up */
export function calcWindowItem(item: ConfigItem, rawPricing: unknown, systems: RawSystem[], lang: 'sl' | 'en' = 'sl'): WindowCalc | null {
  const pr: PricingSettings = pricingFrom(rawPricing)
  if (item.roof) return calcRoofItem(item, rawPricing)
  if (!item.spec || !item.width || !item.height) return null
  const sy = systems.find(s => s.id === item.system_id)
  if (!sy) return null
  const prof = {
    frame_m: Number(sy.frame_m ?? 0), sash_m: Number(sy.sash_m ?? 0), mullion_m: Number(sy.mullion_m ?? 0), bead_m: Number(sy.bead_m ?? 0),
    frame_w: sy.frame_w ?? undefined, sash_w: sy.sash_w ?? undefined, mullion_w: sy.mullion_w ?? undefined,
  }
  const colors = (pr as unknown as { colors?: Record<string, import('./costing').ProfileColor[]> }).colors
  const colorPct = colorPctOf(colors?.[sy.material], item.colors?.out, item.colors?.in)
  const layout = specToLayout(item.spec)
  const labels = lang === 'en' ? LABELS_EN : undefined
  const all = costWindow(layout, item.width, item.height, prof, pr, { colorPct, glassId: item.glass, handleId: item.handle, sillIn: item.sills?.in, sillOut: item.sills?.out, shadeId: item.shading?.shade, screenId: item.shading?.screen, labels })
  // the window alone: standard glass and handle, nothing on top (the lowest price of the profile is for this)
  const alone = costWindow(layout, item.width, item.height, prof, pr, { colorPct, glassId: pr.glass?.[0]?.id ?? item.glass, handleId: pr.handles?.[0]?.id ?? item.handle, labels })
  const minPrice = Number(sy.min_price ?? 0)
  const windowAlone = Math.max(minPrice, alone.price)
  const additions = all.price - alone.price
  const unitPrice = r2(windowAlone + additions)
  const mm = pr.margin_pct ?? 0, lm = pr.labour_margin_pct ?? mm
  return {
    kind: 'window', lines: all.lines, material: all.material, labour: all.labour, cost: all.cost,
    materialMarginPct: mm, labourMarginPct: lm,
    margin: r2(unitPrice - all.cost),
    windowAlone: r2(windowAlone), additions: r2(additions), unitPrice,
    minPrice, minApplied: minPrice > alone.price, calculatedAlone: r2(alone.price),
    colorPct, system: sy.name,
  }
}

/** a roof window: a catalogue price of the model's size, the variant's surcharge and the flashing (sale prices, no margin) */
function calcRoofItem(item: ConfigItem, rawPricing: unknown): WindowCalc | null {
  const cat = (rawPricing as { roof?: { models: any[]; flashings: any[] } } | null)?.roof
  if (!cat || !item.roof) return null
  const m = cat.models.find(x => x.id === item.roof!.model)
  const sz = m?.sizes?.find((x: any) => x.id === item.roof!.size)
  if (!sz) return null
  const fl = cat.flashings.find(x => x.id === item.roof!.flashing)
  const v = m?.variants?.find((x: any) => x.id === item.roof!.variant)
  const size = Number(sz.price), pct = Number(v?.pct ?? 0), flash = Number(fl?.price ?? 0)
  const lines: CutLine[] = [{ key: 'size', label: [m?.brand, m?.name, sz.label ?? ''].filter(Boolean).join(' '), qty: 1, unit: 'kos', price: r2(size), total: r2(size) }]
  if (pct) lines.push({ key: 'variant', label: `${v?.name ?? 'Variant'} (+${pct} %)`, qty: 1, unit: 'kos', price: r2(size * pct / 100), total: r2(size * pct / 100) })
  if (flash) lines.push({ key: 'flashing', label: fl?.name ?? 'Flashing', qty: 1, unit: 'kos', price: r2(flash), total: r2(flash) })
  const unitPrice = roofUnitPrice(size, pct, flash)
  return {
    kind: 'roof', lines, material: unitPrice, labour: 0, cost: unitPrice, materialMarginPct: 0, labourMarginPct: 0, margin: 0,
    windowAlone: unitPrice, additions: 0, unitPrice, minPrice: 0, minApplied: false, calculatedAlone: unitPrice, colorPct: 0, system: [m?.brand, m?.name].filter(Boolean).join(' '),
  }
}
