// Quote math for trades offers: qty × unit price − line discount, quote discount, VAT per rate.

export interface LineInput {
  quantity: number
  unit_price: number
  discount_pct: number
  vat_rate: number
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function lineTotal(l: LineInput): number {
  return r2((l.quantity || 0) * (l.unit_price || 0) * (1 - (l.discount_pct || 0) / 100))
}

export function quoteTotals(lines: LineInput[], discountPct = 0) {
  const subtotal = r2(lines.reduce((a, l) => a + lineTotal(l), 0))
  const factor = 1 - (discountPct || 0) / 100
  const discount_amount = r2(subtotal - subtotal * factor)
  const total_net = r2(subtotal - discount_amount)

  // VAT grouped by rate; quote discount applied proportionally to each base
  const byRate = new Map<number, number>()
  for (const l of lines) byRate.set(l.vat_rate || 0, (byRate.get(l.vat_rate || 0) ?? 0) + lineTotal(l))
  const vat = [...byRate.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, base]) => ({ rate, base: r2(base * factor), amount: r2(base * factor * rate / 100) }))
  const total_vat = r2(vat.reduce((a, v) => a + v.amount, 0))

  return { subtotal, discount_amount, total_net, vat, total_vat, total_gross: r2(total_net + total_vat) }
}

// Room helper: walls (perimeter × height − openings) and ceiling (L × W), in m².
export function roomAreas(length: number, width: number, height: number, openings: number) {
  const walls = Math.max(0, 2 * (length + width) * height - openings)
  const ceiling = length * width
  return { walls: r2(walls), ceiling: r2(ceiling), floor: r2(ceiling), perimeter: r2(2 * (length + width)) }
}
