import type { Quote, Customer, Company, OfferSnapshot, OfferSnapshotLine } from '../types/database'
import { lineTotal, quoteTotals } from './quoteTotals'

function composeAddress(c: { address_street?: string | null; address_postal_code?: string | null; address_city?: string | null; address_country?: string | null } | null): string | null {
  if (!c) return null
  const line1 = c.address_street?.trim()
  const cityLine = [c.address_postal_code, c.address_city].filter(Boolean).join(' ').trim()
  const parts = [line1, cityLine, c.address_country?.trim()].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

type LineIn = Omit<OfferSnapshotLine, 'total'>

// Frozen copy of the offer at issue time — the PDF only ever reads this.
export function buildSnapshot(quote: Quote, customer: Customer | null, company: Company | null, lines: LineIn[]): OfferSnapshot {
  const snapLines: OfferSnapshotLine[] = lines.map(l => ({ ...l, total: lineTotal(l) }))
  const tot = quoteTotals(snapLines, quote.discount_pct ?? 0)

  return {
    offer: {
      number: quote.quote_number,
      title: quote.title || null,
      issued_at: new Date().toISOString(),
      valid_until: quote.valid_until,
      lead_time: quote.lead_time,
      payment_terms: quote.payment_terms,
      parity: quote.parity ?? null,
      notes: quote.notes,
      currency: company?.currency || 'EUR',
      site_address: quote.site_address,
      discount_pct: quote.discount_pct ?? 0,
    },
    customer: {
      name: customer?.name ?? '—',
      vat_number: customer?.vat_number ?? null,
      address: customer?.address || composeAddress(customer),
      contact_person: quote.contact_person,
      contact_email: quote.contact_email,
      contact_phone: quote.contact_phone,
    },
    company: {
      name: company?.name ?? '',
      address: composeAddress(company),
      tax_id: company?.tax_id ?? null,
      legal_form: company?.legal_form ?? null,
      registration_number: company?.registration_number ?? null,
      registry_authority: company?.registry_authority ?? null,
      share_capital: company?.share_capital ?? null,
      unpaid_capital: company?.unpaid_capital ?? null,
      email: company?.email ?? null,
      phone: company?.phone ?? null,
      bank_name: company?.bank_name ?? null,
      bank_iban: company?.bank_iban ?? null,
      logo_url: company?.logo_url ?? null,
      quote_terms: company?.quote_terms ?? null,
      quote_terms_en: company?.quote_terms_en ?? null,
    },
    lines: snapLines,
    subtotal: tot.subtotal,
    discount_amount: tot.discount_amount,
    total_net: tot.total_net,
    vat: tot.vat,
    total_gross: tot.total_gross,
  }
}
