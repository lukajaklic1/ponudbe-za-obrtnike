import { splitLine } from './priceImport'

// Excel / CSV import for customers. Same rules as the services import:
// header row is optional, Slovenian Excel ";" CSV and plain "," CSV both work.

export interface CustomerImportRow {
  line: number
  customer_type: 'person' | 'company'
  first_name: string | null
  last_name: string | null
  company_name: string | null
  vat_number: string | null
  email: string | null
  phone: string | null
  address_street: string | null
  address_postal_code: string | null
  address_city: string | null
  notes: string | null
  error: string | null
}

type Field = 'type' | 'first_name' | 'last_name' | 'company_name' | 'vat_number' | 'email' | 'phone' | 'address_street' | 'address_postal_code' | 'address_city' | 'notes'

export const CUSTOMER_TEMPLATE_HEADER = ['Tip', 'Ime', 'Priimek', 'Podjetje', 'ID za DDV', 'E-pošta', 'Telefon', 'Ulica', 'Poštna št.', 'Kraj', 'Opombe']
export const CUSTOMER_TEMPLATE_EXAMPLE = [
  ['oseba', 'Janez', 'Novak', '', '', 'janez.novak@email.si', '041 123 456', 'Cankarjeva 5', '1000', 'Ljubljana', 'Ključ pri sosedu'],
  ['podjetje', 'Maja', 'Kranjc', 'Gradnje d.o.o.', 'SI12345678', 'info@gradnje.si', '01 234 56 78', 'Dunajska 100', '1000', 'Ljubljana', ''],
]
const TEMPLATE_ORDER: Field[] = ['type', 'first_name', 'last_name', 'company_name', 'vat_number', 'email', 'phone', 'address_street', 'address_postal_code', 'address_city', 'notes']

const HEADER_KEYS: Record<string, Field> = {
  tip: 'type', 'tip stranke': 'type', type: 'type',
  ime: 'first_name', 'first name': 'first_name',
  priimek: 'last_name', 'last name': 'last_name',
  podjetje: 'company_name', 'naziv podjetja': 'company_name', naziv: 'company_name', firma: 'company_name', company: 'company_name',
  'id za ddv': 'vat_number', 'davčna številka': 'vat_number', 'davčna': 'vat_number', ddv: 'vat_number', vat: 'vat_number', 'vat number': 'vat_number',
  'e-pošta': 'email', 'e-posta': 'email', email: 'email', 'e-mail': 'email', mail: 'email',
  telefon: 'phone', tel: 'phone', gsm: 'phone', phone: 'phone',
  ulica: 'address_street', naslov: 'address_street', street: 'address_street', address: 'address_street',
  'poštna št.': 'address_postal_code', 'poštna številka': 'address_postal_code', 'postna st.': 'address_postal_code', pošta: 'address_postal_code', posta: 'address_postal_code', 'postal code': 'address_postal_code',
  kraj: 'address_city', mesto: 'address_city', city: 'address_city',
  opombe: 'notes', opomba: 'notes', notes: 'notes',
}

const COMPANY_WORDS = ['podjetje', 'pravna oseba', 'company', 'p']
const PERSON_WORDS = ['oseba', 'fizična oseba', 'fizicna oseba', 'person', 'individual', 'f']

function rowsToCustomers(table: string[][]): CustomerImportRow[] {
  const rows = table.filter(r => r.some(c => c.trim()))
  if (!rows.length) return []
  const header = rows[0].map(h => HEADER_KEYS[h.trim().toLowerCase()] ?? null)
  const hasHeader = header.some(Boolean)
  const cols = hasHeader ? header : TEMPLATE_ORDER
  const body = hasHeader ? rows.slice(1) : rows

  return body.map((cells, i) => {
    const get = (k: Field) => { const idx = cols.indexOf(k); return idx >= 0 ? (cells[idx] ?? '').trim() || null : null }
    const typeRaw = (get('type') ?? '').toLowerCase()
    const company = get('company_name')
    // Type column wins; without it, a company name means a company
    let type: 'person' | 'company' | null = company ? 'company' : 'person'
    if (typeRaw) type = COMPANY_WORDS.includes(typeRaw) ? 'company' : PERSON_WORDS.includes(typeRaw) ? 'person' : null
    const first = get('first_name'), last = get('last_name')
    let error: string | null = null
    if (!type) error = 'type'
    else if (type === 'company' && !company) error = 'company'
    else if (type === 'person' && (!first || !last)) error = 'person'
    return {
      line: i + (hasHeader ? 2 : 1),
      customer_type: type ?? 'person',
      first_name: first, last_name: last,
      company_name: type === 'company' ? company : null,
      vat_number: type === 'company' ? get('vat_number') : null,
      email: get('email'), phone: get('phone'),
      address_street: get('address_street'), address_postal_code: get('address_postal_code'), address_city: get('address_city'),
      notes: get('notes'),
      error,
    }
  })
}

export function parseCustomerCsv(text: string): CustomerImportRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return []
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
  return rowsToCustomers(lines.map(l => splitLine(l, sep)))
}

export function parseCustomerSheet(cells: unknown[][]): CustomerImportRow[] {
  return rowsToCustomers(cells.map(r => r.map(c => (c == null ? '' : String(c)))))
}

export function customerDisplayName(r: CustomerImportRow): string {
  return r.customer_type === 'company' ? (r.company_name ?? '') : `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim()
}
