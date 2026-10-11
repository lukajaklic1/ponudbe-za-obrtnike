import type { Company, Customer, Invoice, InvoiceSnapshot, InvoiceStatus, PurchaseCategory } from '../types/database'
import { lineTotal, quoteTotals } from './quoteTotals'

export const INVOICE_STATUSES: InvoiceStatus[] = ['draft', 'issued', 'sent', 'paid', 'cancelled']

export const INVOICE_STATUS_LABEL: Record<'sl' | 'en', Record<InvoiceStatus | 'overdue', string>> = {
  sl: { draft: 'Osnutek', issued: 'Izdan', sent: 'Poslan', paid: 'Plačan', cancelled: 'Storniran', overdue: 'Zapadel' },
  en: { draft: 'Draft', issued: 'Issued', sent: 'Sent', paid: 'Paid', cancelled: 'Cancelled', overdue: 'Overdue' },
}

export const INVOICE_STATUS_STYLE: Record<InvoiceStatus | 'overdue', { bg: string; border: string; color: string }> = {
  draft:     { bg: '#fff3cc', border: '#ffe5a0', color: '#874d00' },
  issued:    { bg: '#f3edff', border: '#e6dbff', color: '#6b3fc9' },
  sent:      { bg: '#e5eeff', border: '#d6e5ff', color: '#215bcf' },
  paid:      { bg: '#e0fced', border: '#d4f8e6', color: '#098259' },
  cancelled: { bg: '#f5f5f5', border: '#e5e7eb', color: '#6b7280' },
  overdue:   { bg: '#feeee1', border: '#fee0c8', color: '#9e3f00' },
}

export const KIND_LABEL = {
  sl: { invoice: 'Račun', advance: 'Avansni račun' },
  en: { invoice: 'Invoice', advance: 'Advance invoice' },
}

export const PURCHASE_CATEGORIES: PurchaseCategory[] = ['material', 'tools', 'subcontract', 'fuel', 'rent', 'other']
export const PURCHASE_CATEGORY_LABEL: Record<'sl' | 'en', Record<PurchaseCategory, string>> = {
  sl: { material: 'Material', tools: 'Orodje in oprema', subcontract: 'Podizvajalci', fuel: 'Gorivo in prevoz', rent: 'Najem', other: 'Drugo' },
  en: { material: 'Material', tools: 'Tools & equipment', subcontract: 'Subcontractors', fuel: 'Fuel & transport', rent: 'Rent', other: 'Other' },
}

export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const addDaysIso = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const x = new Date(y, m - 1, d + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
export const fmtDate = (iso: string | null | undefined) => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${Number(d)}. ${Number(m)}. ${y}` }

// Still to be paid and past the due date
export const isOverdue = (i: Pick<Invoice, 'status' | 'due_date'>) =>
  (i.status === 'issued' || i.status === 'sent') && !!i.due_date && i.due_date < todayIso()
export const daysOverdue = (i: Pick<Invoice, 'due_date'>) =>
  i.due_date ? Math.max(0, Math.round((Date.parse(todayIso()) - Date.parse(i.due_date)) / 86400000)) : 0
export const displayStatus = (i: Pick<Invoice, 'status' | 'due_date'>): InvoiceStatus | 'overdue' => isOverdue(i) ? 'overdue' : i.status

// Reference for the payment (model SI00, no check digit): R-2026-0001 → SI00 2026-0001
export function referenceFor(number: string): string {
  const digits = number.replace(/^[^0-9]*/, '').replace(/[^0-9-]/g, '')
  return `SI00 ${digits || number}`
}

function splitAddress(c: { address_street?: string | null; address_postal_code?: string | null; address_city?: string | null } | null) {
  return {
    street: c?.address_street?.trim() || null,
    city: [c?.address_postal_code, c?.address_city].filter(Boolean).join(' ').trim() || null,
  }
}

export interface LineIn { name: string; description: string | null; unit: string; quantity: number; unit_price: number; discount_pct: number; vat_rate: number }

export function invoiceTotals(lines: LineIn[], discountPct = 0) {
  return quoteTotals(lines, discountPct)
}

export function buildInvoiceSnapshot(
  inv: Pick<Invoice, 'invoice_number' | 'kind' | 'title' | 'issue_date' | 'service_date' | 'service_date_to' | 'due_date' | 'reference' | 'notes' | 'discount_pct'>,
  customer: Customer | null, company: Company | null, lines: LineIn[], extra: { quote_number: string | null; site_address: string | null },
): InvoiceSnapshot {
  const snapLines = lines.map(l => ({ ...l, total: lineTotal(l) }))
  const tot = invoiceTotals(snapLines, inv.discount_pct ?? 0)
  const ca = splitAddress(company), cu = splitAddress(customer)
  return {
    invoice: {
      number: inv.invoice_number ?? '', kind: inv.kind, title: inv.title,
      issue_date: inv.issue_date, service_date: inv.service_date, service_date_to: inv.service_date_to, due_date: inv.due_date,
      reference: inv.reference, notes: inv.notes, currency: company?.currency || 'EUR', discount_pct: inv.discount_pct ?? 0,
      quote_number: extra.quote_number, site_address: extra.site_address,
    },
    customer: {
      name: customer?.name ?? '—', vat_number: customer?.vat_number ?? null, email: customer?.email ?? null,
      street: cu.street, city: cu.city, address: [cu.street, cu.city].filter(Boolean).join(', ') || customer?.address || null,
    },
    company: {
      name: company?.name ?? '', address: [ca.street, ca.city].filter(Boolean).join(', ') || null, street: ca.street, city: ca.city,
      tax_id: company?.tax_id ?? null, legal_form: company?.legal_form ?? null, registration_number: company?.registration_number ?? null,
      registry_authority: company?.registry_authority ?? null, share_capital: company?.share_capital ?? null, unpaid_capital: company?.unpaid_capital ?? null,
      email: company?.email ?? null, phone: company?.phone ?? null, bank_name: company?.bank_name ?? null, bank_iban: company?.bank_iban ?? null,
      logo_url: company?.logo_url ?? null, quote_terms: null, quote_terms_en: null,
      vat_payer: company?.vat_payer ?? true, invoice_note: company?.invoice_note ?? null,
    },
    lines: snapLines,
    subtotal: tot.subtotal, discount_amount: tot.discount_amount, total_net: tot.total_net,
    vat: tot.vat, total_vat: tot.total_vat, total_gross: tot.total_gross,
  }
}

// ─── UPN QR (ZBS standard) ──────────────────────────────────
// Bank apps read the payment from this code. Text is reduced to plain ASCII
// so the QR's byte encoding can never garble č / š / ž.
const ascii = (s: string | null | undefined, max: number) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '').trim().slice(0, max)

export function upnQrPayload(snap: InvoiceSnapshot): string | null {
  const iban = (snap.company.bank_iban ?? '').replace(/\s+/g, '').toUpperCase()
  if (!iban || snap.total_gross <= 0) return null
  const [y, m, d] = (snap.invoice.due_date ?? snap.invoice.issue_date).split('-')
  const fields = [
    'UPNQR', '', '', '', '',
    ascii(snap.customer.name, 33), ascii(snap.customer.street, 33), ascii(snap.customer.city, 33),
    String(Math.round(snap.total_gross * 100)).padStart(11, '0'),
    '', '', 'OTHR',
    ascii(`Placilo racuna ${snap.invoice.number}`, 42),
    `${d}.${m}.${y}`,
    iban,
    ascii((snap.invoice.reference ?? '').replace(/\s+/g, ''), 26),
    ascii(snap.company.name, 33), ascii(snap.company.street, 33), ascii(snap.company.city, 33),
  ]
  const body = fields.map(f => f + '\n').join('')
  return body + String(body.length).padStart(3, '0') + '\n'
}
