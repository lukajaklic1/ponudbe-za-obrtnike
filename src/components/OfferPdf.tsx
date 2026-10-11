import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import type { OfferSnapshot, OfferSnapshotLine } from '../types/database'
import FontRegular from '../assets/Arial.ttf?url'
import FontBold from '../assets/Arial-Bold.ttf?url'

Font.register({
  family: 'Roboto',
  fonts: [
    { src: FontRegular, fontWeight: 400 },
    { src: FontBold, fontWeight: 700 },
  ],
})

const c = {
  primary: '#111827',
  text: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  strip: '#f1f1f1',
  rowAlt: '#f9f9f9',
  white: '#ffffff',
}

const s = StyleSheet.create({
  page: { fontFamily: 'Roboto', fontSize: 9, color: c.text, paddingHorizontal: 40, paddingTop: 36, paddingBottom: 80, backgroundColor: c.white },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 14 },
  companyBlock: { flex: 1 },
  companyName: { fontSize: 15, fontWeight: 700, color: c.primary, marginBottom: 4 },
  companyDetail: { fontSize: 8, color: c.muted, lineHeight: 1.5 },
  titleBlock: { alignItems: 'flex-end' },
  titleLabel: { fontSize: 24, fontWeight: 700, color: c.primary, marginBottom: 4 },
  titleNumber: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  titleDate: { fontSize: 8, color: c.muted },

  partiesRow: { flexDirection: 'row', marginBottom: 16, gap: 20 },
  party: { flex: 1 },
  partyLabel: { fontSize: 7, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  partyName: { fontSize: 11, fontWeight: 700, marginBottom: 3 },
  partyDetail: { fontSize: 8.5, color: c.muted, lineHeight: 1.5 },

  termsRow: { flexDirection: 'row', backgroundColor: c.strip, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 18, borderWidth: 1, borderColor: c.border },
  termItem: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  termLabel: { fontSize: 7, color: c.muted, marginBottom: 2, textAlign: 'center' },
  termValue: { fontSize: 9, fontWeight: 700, textAlign: 'center', lineHeight: 1.35 },
  termDivider: { width: 1, backgroundColor: c.border, marginVertical: 2 },

  tableHeader: { flexDirection: 'row', backgroundColor: c.strip, paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  thText: { fontSize: 7.5, fontWeight: 700, color: c.muted },
  colPos: { width: 22 },
  colName: { flex: 1, paddingRight: 6 },
  colQty: { width: 46, textAlign: 'right' },
  colUnit: { width: 30, textAlign: 'center' },
  colPrice: { width: 58, textAlign: 'right' },
  colDisc: { width: 32, textAlign: 'right' },
  colVat: { width: 32, textAlign: 'right' },
  colTotal: { width: 66, textAlign: 'right' },

  roomRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 8, marginTop: 6, borderBottomWidth: 1, borderBottomColor: c.border },
  roomName: { fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 },
  roomSum: { fontSize: 8.5, fontWeight: 700 },

  row: { flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: 5, paddingHorizontal: 8 },
  rowAlt: { backgroundColor: c.rowAlt },
  cell: { fontSize: 8.5 },
  itemName: { fontSize: 8.5 },
  itemDesc: { fontSize: 7.5, color: c.muted, marginTop: 1 },

  totals: { marginTop: 14, alignSelf: 'flex-end', width: 250 },
  totLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totLabel: { fontSize: 8.5, color: c.muted },
  totValue: { fontSize: 8.5 },
  grandBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.strip, borderRadius: 4, paddingVertical: 9, paddingHorizontal: 12, marginTop: 6, borderWidth: 1, borderColor: c.border },
  grandLabel: { fontSize: 10, fontWeight: 700 },
  grandValue: { fontSize: 13, fontWeight: 700 },

  notesBox: { marginTop: 18, backgroundColor: c.strip, borderRadius: 4, padding: 10, borderWidth: 1, borderColor: c.border },
  smallLabel: { fontSize: 7, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  notesText: { fontSize: 8.5, lineHeight: 1.6 },
  termsBox: { marginTop: 14, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
  termsText: { fontSize: 7.5, color: c.muted, lineHeight: 1.5 },


  footer: { position: 'absolute', bottom: 18, left: 40, right: 40, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 6 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  footerLines: { flex: 1, paddingRight: 16 },
  // same line height for every footer line → even spacing
  footerText: { fontSize: 7, color: c.muted, marginBottom: 2 },
})

function fmtNum(n: number, decimals = 2) {
  const neg = n < 0
  const parts = Math.abs(n).toFixed(decimals).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (neg ? '−' : '') + (decimals > 0 ? parts[0] + ',' + parts[1] : parts[0])
}
const eur = (n: number) => fmtNum(n, 2) + ' €'
const pct = (n: number) => fmtNum(n, n % 1 ? 1 : 0) + ' %'
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('sl-SI') } catch { return String(d) }
}

const UNIT = {
  sl: { m2: 'm²', m: 'm', pcs: 'kos', h: 'h', lump: 'pavš.', l: 'l', kg: 'kg' } as Record<string, string>,
  en: { m2: 'm²', m: 'm', pcs: 'pc', h: 'h', lump: 'lump', l: 'l', kg: 'kg' } as Record<string, string>,
}

const L = {
  sl: {
    title: 'PONUDBA', date: 'Datum', customer: 'Naročnik', site: 'Lokacija del', contractor: 'Izvajalec',
    vatId: 'ID za DDV', regNo: 'Matična št.', registry: 'Registrski organ', shareCapital: 'Osnovni kapital', unpaid: 'nevplačani', validity: 'Veljavnost', execution: 'Rok izvedbe', paymentTerms: 'Plačilni pogoji', parity: 'Pariteta',
    pos: 'Poz.', item: 'Opis del', qty: 'Kol.', unit: 'EM', price: 'Cena/EM', disc: 'Pop.', vat: 'DDV', total: 'Vrednost',
    general: 'Splošno', subtotal: 'Skupaj postavke', discount: 'Popust', net: 'Skupaj brez DDV', vatLine: (r: string) => `DDV ${r}`,
    gross: 'ZA PLAČILO', notes: 'Opombe', terms: 'Pogoji',
    page: (n: number, t: number) => `Stran ${n} / ${t}`,
  },
  en: {
    title: 'QUOTATION', date: 'Date', customer: 'Client', site: 'Job site', contractor: 'Contractor',
    vatId: 'VAT ID', regNo: 'Reg. no.', registry: 'Registry', shareCapital: 'Share capital', unpaid: 'unpaid', validity: 'Valid until', execution: 'Execution time', paymentTerms: 'Payment terms', parity: 'Incoterms',
    pos: 'Pos.', item: 'Description of work', qty: 'Qty', unit: 'Unit', price: 'Unit price', disc: 'Disc.', vat: 'VAT', total: 'Amount',
    general: 'General', subtotal: 'Items total', discount: 'Discount', net: 'Total excl. VAT', vatLine: (r: string) => `VAT ${r}`,
    gross: 'TOTAL DUE', notes: 'Notes', terms: 'Terms',
    page: (n: number, t: number) => `Page ${n} / ${t}`,
  },
}

export default function OfferPdf({ snap, lang = 'sl' }: { snap: OfferSnapshot; lang?: 'sl' | 'en' }) {
  if (!snap?.lines) return <Document><Page><Text>No data</Text></Page></Document>

  const { offer, company, customer, lines } = snap
  const T = L[lang]
  const U = UNIT[lang]
  const hasDisc = lines.some(l => l.discount_pct > 0)

  // Group by room, keeping first-appearance order
  const groups: { room: string | null; lines: OfferSnapshotLine[] }[] = []
  for (const l of lines) {
    const g = groups.find(x => x.room === l.room)
    if (g) g.lines.push(l); else groups.push({ room: l.room, lines: [l] })
  }
  const showGroups = groups.length > 1 || !!groups[0]?.room

  const bankLine = [company.bank_iban && `IBAN: ${company.bank_iban}`, company.bank_name].filter(Boolean).join(' · ')
  // Legally required company details (ZGD-1): firma, sedež, matična št.; d.o.o./d.d. also registry + share capital
  const footerLeft = [company.name, company.address].filter(Boolean).join(' · ')
  const idLine = [company.registration_number && `${T.regNo}: ${company.registration_number}`, company.tax_id && `${T.vatId}: ${company.tax_id}`].filter(Boolean).join(' · ')
  const isCapitalCompany = company.legal_form === 'doo' || company.legal_form === 'dd'
  const legalLine = isCapitalCompany ? [
    company.registry_authority && `${T.registry}: ${company.registry_authority}`,
    company.share_capital != null && `${T.shareCapital}: ${eur(company.share_capital)}` + (company.unpaid_capital ? ` (${T.unpaid}: ${eur(company.unpaid_capital)})` : ''),
  ].filter(Boolean).join(' · ') : ''
  const terms = lang === 'en' ? company.quote_terms_en : company.quote_terms
  let pos = 0

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View style={s.companyBlock}>
            <Text style={s.companyName}>{company.name}</Text>
            {company.address && <Text style={s.companyDetail}>{company.address}</Text>}
            {company.phone && <Text style={s.companyDetail}>{company.phone}</Text>}
            {company.email && <Text style={s.companyDetail}>{company.email}</Text>}
            {company.tax_id && <Text style={s.companyDetail}>{T.vatId}: {company.tax_id}</Text>}
          </View>
          <View style={s.titleBlock}>
            <Text style={s.titleLabel}>{T.title}</Text>
            <Text style={s.titleNumber}>{offer.number}</Text>
            {offer.title ? <Text style={[s.titleDate, { color: c.text, marginBottom: 2, maxWidth: 220, textAlign: 'right' }]}>{offer.title}</Text> : null}
            <Text style={s.titleDate}>{T.date}: {fmtDate(offer.issued_at)}</Text>
          </View>
        </View>

        <View style={s.partiesRow}>
          <View style={s.party}>
            <Text style={s.partyLabel}>{T.customer}</Text>
            <Text style={s.partyName}>{customer.name}</Text>
            {customer.address && <Text style={s.partyDetail}>{customer.address}</Text>}
            {customer.vat_number && <Text style={s.partyDetail}>{T.vatId}: {customer.vat_number}</Text>}
            {customer.contact_person && <Text style={s.partyDetail}>{customer.contact_person}</Text>}
            {customer.contact_phone && <Text style={s.partyDetail}>{customer.contact_phone}</Text>}
            {customer.contact_email && <Text style={s.partyDetail}>{customer.contact_email}</Text>}
          </View>
          {offer.site_address && (
            <View style={s.party}>
              <Text style={s.partyLabel}>{T.site}</Text>
              <Text style={[s.partyDetail, { color: c.text, fontSize: 9.5 }]}>{offer.site_address}</Text>
            </View>
          )}
        </View>

        <View style={s.termsRow}>
          {([[T.validity, fmtDate(offer.valid_until)], [T.execution, offer.lead_time || '—'], [T.paymentTerms, offer.payment_terms || '—'], ...(offer.parity ? [[T.parity, offer.parity]] : [])] as [string, string][]).map(([lbl, val], i) => (
            <View key={lbl} style={{ flex: lbl === T.paymentTerms ? 1.6 : 1, flexDirection: 'row' }}>
              {i > 0 && <View style={s.termDivider} />}
              <View style={s.termItem}>
                <Text style={s.termLabel}>{lbl}</Text>
                <Text style={s.termValue}>{val}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.tableHeader} fixed>
          <Text style={[s.thText, s.colPos]}>{T.pos}</Text>
          <Text style={[s.thText, s.colName]}>{T.item}</Text>
          <Text style={[s.thText, s.colQty]}>{T.qty}</Text>
          <Text style={[s.thText, s.colUnit]}>{T.unit}</Text>
          <Text style={[s.thText, s.colPrice]}>{T.price}</Text>
          {hasDisc && <Text style={[s.thText, s.colDisc]}>{T.disc}</Text>}
          <Text style={[s.thText, s.colVat]}>{T.vat}</Text>
          <Text style={[s.thText, s.colTotal]}>{T.total}</Text>
        </View>

        {groups.map((g, gi) => (
          <View key={gi}>
            {showGroups && (
              <View style={s.roomRow} wrap={false}>
                <Text style={s.roomName}>{g.room || T.general}</Text>
                <Text style={s.roomSum}>{eur(g.lines.reduce((a, l) => a + l.total, 0))}</Text>
              </View>
            )}
            {g.lines.map((l, li) => {
              pos++
              return (
                <View key={li} style={[s.row, li % 2 === 1 ? s.rowAlt : {}]} wrap={false}>
                  <Text style={[s.cell, s.colPos]}>{pos}</Text>
                  <View style={s.colName}>
                    <Text style={s.itemName}>{l.name}</Text>
                    {l.description && <Text style={s.itemDesc}>{l.description}</Text>}
                  </View>
                  <Text style={[s.cell, s.colQty]}>{fmtNum(l.quantity)}</Text>
                  <Text style={[s.cell, s.colUnit, { color: c.muted }]}>{U[l.unit] ?? l.unit}</Text>
                  <Text style={[s.cell, s.colPrice]}>{eur(l.unit_price)}</Text>
                  {hasDisc && <Text style={[s.cell, s.colDisc]}>{l.discount_pct ? pct(l.discount_pct) : ''}</Text>}
                  <Text style={[s.cell, s.colVat, { color: c.muted }]}>{pct(l.vat_rate)}</Text>
                  <Text style={[s.cell, s.colTotal, { fontWeight: 700 }]}>{eur(l.total)}</Text>
                </View>
              )
            })}
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          {snap.discount_amount > 0 && <>
            <View style={s.totLine}><Text style={s.totLabel}>{T.subtotal}</Text><Text style={s.totValue}>{eur(snap.subtotal)}</Text></View>
            <View style={s.totLine}><Text style={s.totLabel}>{T.discount} {pct(offer.discount_pct ?? 0)}</Text><Text style={s.totValue}>{eur(-snap.discount_amount)}</Text></View>
          </>}
          <View style={s.totLine}><Text style={[s.totLabel, { color: c.text, fontWeight: 700 }]}>{T.net}</Text><Text style={[s.totValue, { fontWeight: 700 }]}>{eur(snap.total_net)}</Text></View>
          {snap.vat.map(v => (
            <View key={v.rate} style={s.totLine}><Text style={s.totLabel}>{T.vatLine(pct(v.rate))} ({eur(v.base)})</Text><Text style={s.totValue}>{eur(v.amount)}</Text></View>
          ))}
          <View style={s.grandBox}>
            <Text style={s.grandLabel}>{T.gross}</Text>
            <Text style={s.grandValue}>{eur(snap.total_gross)}</Text>
          </View>
        </View>

        {offer.notes && (
          <View style={s.notesBox} wrap={false}>
            <Text style={s.smallLabel}>{T.notes}</Text>
            <Text style={s.notesText}>{offer.notes}</Text>
          </View>
        )}

        {terms && (
          <View style={s.termsBox}>
            <Text style={s.smallLabel}>{T.terms}</Text>
            <Text style={s.termsText}>{terms}</Text>
          </View>
        )}


        <View style={s.footer} fixed>
          <View style={s.footerRow}>
            <View style={s.footerLines}>
              <Text style={s.footerText}>{footerLeft}</Text>
              {idLine ? <Text style={s.footerText}>{idLine}</Text> : null}
              {legalLine ? <Text style={s.footerText}>{legalLine}</Text> : null}
              {bankLine ? <Text style={s.footerText}>{bankLine}</Text> : null}
            </View>
            <Text style={s.footerText} render={({ pageNumber, totalPages }) => T.page(pageNumber, totalPages)} />
          </View>
        </View>
      </Page>
    </Document>
  )
}
