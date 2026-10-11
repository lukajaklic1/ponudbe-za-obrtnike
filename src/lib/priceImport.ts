import type { PriceUnit } from '../types/database'

// CSV import for the services price list. Accepts files saved from Excel
// (Slovenian Excel uses ";" and decimal comma) as well as plain comma CSV.

export interface ImportRow {
  line: number
  code: string | null
  name: string
  description: string | null
  unit: PriceUnit
  price: number
  vat_rate: number
  error: string | null
}

export const TEMPLATE_HEADER = ['Šifra', 'Naziv', 'Opis', 'Enota', 'Cena', 'DDV']
export const TEMPLATE_EXAMPLE = [
  ['S01', 'Beljenje sten, bela, 2×', 'Impregnacija + 2 premaza', 'm2', '4,50', '22'],
  ['S02', 'Čiščenje po končanih delih', '', 'pavšal', '60,00', '22'],
]

// Split one CSV line, honouring "quoted; fields" and doubled quotes.
export function splitLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') q = false
      else cur += ch
    } else if (ch === '"') q = true
    else if (ch === sep) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out.map(s => s.trim())
}

// "1.234,50" / "1234.50" / "4,5 €" → number
export function parseNumber(raw: string): number | null {
  let s = raw.replace(/[€\s%]/g, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const UNIT_ALIASES: Record<string, PriceUnit> = {
  m2: 'm2', 'm²': 'm2', 'm^2': 'm2', kvm: 'm2',
  m: 'm', tm: 'm', 'm1': 'm',
  kos: 'pcs', kom: 'pcs', pcs: 'pcs', pc: 'pcs',
  h: 'h', ura: 'h', ur: 'h', ure: 'h',
  'pavšal': 'lump', pavsal: 'lump', pav: 'lump', lump: 'lump', kpl: 'lump',
  l: 'l', lit: 'l', liter: 'l',
  kg: 'kg',
}

const HEADER_KEYS: Record<string, keyof Omit<ImportRow, 'line' | 'error'>> = {
  'šifra': 'code', sifra: 'code', code: 'code', koda: 'code',
  naziv: 'name', postavka: 'name', storitev: 'name', name: 'name',
  opis: 'description', description: 'description',
  enota: 'unit', em: 'unit', unit: 'unit',
  cena: 'price', 'cena/em': 'price', price: 'price',
  ddv: 'vat_rate', vat: 'vat_rate',
}

export function parsePriceCsv(text: string): ImportRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return []
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const header = splitLine(lines[0], sep).map(h => HEADER_KEYS[h.toLowerCase()] ?? null)
  const hasHeader = header.some(Boolean)
  // Without a header, assume the template order
  const cols = hasHeader ? header : (['code', 'name', 'description', 'unit', 'price', 'vat_rate'] as const)
  const body = hasHeader ? lines.slice(1) : lines

  return body.map((l, i) => {
    const cells = splitLine(l, sep)
    const get = (k: string) => { const idx = cols.indexOf(k as never); return idx >= 0 ? (cells[idx] ?? '') : '' }
    const name = get('name')
    const unitRaw = get('unit').toLowerCase()
    const unit = unitRaw ? UNIT_ALIASES[unitRaw] : 'm2'
    const price = parseNumber(get('price'))
    const vatRaw = parseNumber(get('vat_rate'))
    const vat = vatRaw == null ? 22 : vatRaw
    let error: string | null = null
    if (!name) error = 'name'
    else if (!unit) error = 'unit'
    else if (price == null || price < 0) error = 'price'
    else if (![22, 9.5, 0].includes(vat)) error = 'vat'
    return {
      line: i + (hasHeader ? 2 : 1),
      code: get('code') || null,
      name,
      description: get('description') || null,
      unit: unit ?? 'm2',
      price: price ?? 0,
      vat_rate: vat,
      error,
    }
  })
}

// Rows from an Excel sheet (array of cell arrays) → same parsing as CSV
export function parsePriceSheet(cells: unknown[][]): ImportRow[] {
  const quote = (v: unknown) => { const t = v == null ? '' : String(v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
  return parsePriceCsv(cells.filter(r => r.some(c => String(c ?? '').trim())).map(r => r.map(quote).join(';')).join('\n'))
}
