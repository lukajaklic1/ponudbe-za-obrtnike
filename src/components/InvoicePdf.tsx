import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import type { InvoiceSnapshot } from '../types/database'
import { upnQrPayload } from '../lib/invoices'
import './OfferPdf'   // registers the PDF font

const c = { text: '#111827', muted: '#6b7280', border: '#e5e7eb', strip: '#f1f1f1', rowAlt: '#f9f9f9', white: '#ffffff' }

const s = StyleSheet.create({
  page: { fontFamily: 'Roboto', fontSize: 9, color: c.text, paddingHorizontal: 40, paddingTop: 36, paddingBottom: 80, backgroundColor: c.white },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 14 },
  companyName: { fontSize: 15, fontWeight: 700, marginBottom: 4 },
  companyDetail: { fontSize: 8, color: c.muted, lineHeight: 1.5 },
  titleBlock: { alignItems: 'flex-end' },
  titleLabel: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  titleNumber: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  titleSub: { fontSize: 8, color: c.muted },

  partiesRow: { flexDirection: 'row', marginBottom: 16, gap: 20 },
  party: { flex: 1 },
  partyLabel: { fontSize: 7, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  partyName: { fontSize: 11, fontWeight: 700, marginBottom: 3 },
  partyDetail: { fontSize: 8.5, color: c.muted, lineHeight: 1.5 },

  termsRow: { flexDirection: 'row', backgroundColor: c.strip, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 18, borderWidth: 1, borderColor: c.border },
  termItem: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  termLabel: { fontSize: 7, color: c.muted, marginBottom: 2, textAlign: 'center' },
  termValue: { fontSize: 9, fontWeight: 700, textAlign: 'center' },
  termDivider: { width: 1, backgroundColor: c.border, marginVertical: 2 },

  tableHeader: { flexDirection: 'row', backgroundColor: c.strip, paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  thText: { fontSize: 7.5, fontWeight: 700, color: c.muted },
  colPos: { width: 22 }, colName: { flex: 1, paddingRight: 6 }, colQty: { width: 46, textAlign: 'right' }, colUnit: { width: 30, textAlign: 'center' },
  colPrice: { width: 58, textAlign: 'right' }, colDisc: { width: 32, textAlign: 'right' }, colVat: { width: 32, textAlign: 'right' }, colTotal: { width: 66, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: 5, paddingHorizontal: 8 },
  cell: { fontSize: 8.5 },
  itemDesc: { fontSize: 7.5, color: c.muted, marginTop: 1 },

  totals: { marginTop: 14, alignSelf: 'flex-end', width: 250 },
  totLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totLabel: { fontSize: 8.5, color: c.muted },
  totValue: { fontSize: 8.5 },
  grandBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.strip, borderRadius: 4, paddingVertical: 9, paddingHorizontal: 12, marginTop: 6, borderWidth: 1, borderColor: c.border },
  grandLabel: { fontSize: 10, fontWeight: 700 },
  grandValue: { fontSize: 13, fontWeight: 700 },

  payBox: { marginTop: 18, flexDirection: 'row', borderWidth: 1, borderColor: c.border, borderRadius: 4, padding: 12, gap: 16 },
  payCol: { flex: 1 },
  payLine: { flexDirection: 'row', paddingVertical: 2 },
  payLabel: { width: 90, fontSize: 8.5, color: c.muted },
  payValue: { flex: 1, fontSize: 8.5, fontWeight: 700 },
  qr: { width: 92, height: 92 },
  qrCaption: { fontSize: 6.5, color: c.muted, textAlign: 'center', marginTop: 2 },

  smallLabel: { fontSize: 7, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  noteBox: { marginTop: 14, backgroundColor: c.strip, borderRadius: 4, padding: 10, borderWidth: 1, borderColor: c.border },
  noteText: { fontSize: 8.5, lineHeight: 1.6 },
  legalNote: { marginTop: 10, fontSize: 8, color: c.text },

  footer: { position: 'absolute', bottom: 18, left: 40, right: 40, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 6 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
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
const date = (iso: string | null | undefined) => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${Number(d)}. ${Number(m)}. ${y}` }

const UNIT: Record<string, string> = { m2: 'm²', m: 'm', pcs: 'kos', h: 'h', lump: 'pavš.', l: 'l', kg: 'kg' }

const T = {
  invoice: 'RAČUN', advance: 'AVANSNI RAČUN', customer: 'Kupec', site: 'Lokacija del', basedOn: 'Po ponudbi',
  issued: 'Datum izdaje', service: 'Datum opravljene storitve', servicePeriod: 'Obdobje opravljene storitve', advanceDate: 'Datum prejema avansa', due: 'Rok plačila', ref: 'Sklic',
  pos: 'Poz.', item: 'Opis', qty: 'Kol.', unit: 'EM', price: 'Cena/EM', disc: 'Pop.', vat: 'DDV', total: 'Vrednost',
  subtotal: 'Skupaj postavke', discount: 'Popust', net: 'Skupaj brez DDV', vatLine: (r: string) => `DDV ${r}`, gross: 'ZA PLAČILO',
  payment: 'Podatki za plačilo', iban: 'IBAN', bank: 'Banka', recipient: 'Prejemnik', amount: 'Znesek', purpose: 'Namen', scan: 'Skenirajte za plačilo',
  notes: 'Opombe', vatId: 'ID za DDV', regNo: 'Matična št.', registry: 'Registrski organ', shareCapital: 'Osnovni kapital', unpaid: 'nevplačani',
  noVat: 'DDV ni obračunan na podlagi 1. odstavka 94. člena ZDDV-1.',
  advanceNote: 'Avansni račun. Znesek avansa bo poračunan v končnem računu.',
  page: (n: number, t: number) => `Stran ${n} / ${t}`,
}

export default function InvoicePdf({ snap, qr }: { snap: InvoiceSnapshot; qr: string | null }) {
  const { invoice, company, customer, lines } = snap
  const hasDisc = lines.some(l => l.discount_pct > 0)
  const isAdvance = invoice.kind === 'advance'
  const serviceLabel = isAdvance ? T.advanceDate : invoice.service_date_to && invoice.service_date_to !== invoice.service_date ? T.servicePeriod : T.service
  const serviceValue = invoice.service_date_to && invoice.service_date_to !== invoice.service_date
    ? `${date(invoice.service_date)} – ${date(invoice.service_date_to)}` : date(invoice.service_date ?? invoice.issue_date)

  const footerLeft = [company.name, company.address].filter(Boolean).join(' · ')
  const idLine = [company.registration_number && `${T.regNo}: ${company.registration_number}`, company.tax_id && `${T.vatId}: ${company.tax_id}`].filter(Boolean).join(' · ')
  const isCapitalCompany = company.legal_form === 'doo' || company.legal_form === 'dd'
  const legalLine = isCapitalCompany ? [
    company.registry_authority && `${T.registry}: ${company.registry_authority}`,
    company.share_capital != null && `${T.shareCapital}: ${eur(company.share_capital)}` + (company.unpaid_capital ? ` (${T.unpaid}: ${eur(company.unpaid_capital)})` : ''),
  ].filter(Boolean).join(' · ') : ''
  const bankLine = [company.bank_iban && `IBAN: ${company.bank_iban}`, company.bank_name].filter(Boolean).join(' · ')

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.companyName}>{company.name}</Text>
            {company.address && <Text style={s.companyDetail}>{company.address}</Text>}
            {company.phone && <Text style={s.companyDetail}>{company.phone}</Text>}
            {company.email && <Text style={s.companyDetail}>{company.email}</Text>}
            {company.tax_id && <Text style={s.companyDetail}>{T.vatId}: {company.tax_id}</Text>}
          </View>
          <View style={s.titleBlock}>
            <Text style={s.titleLabel}>{isAdvance ? T.advance : T.invoice}</Text>
            <Text style={s.titleNumber}>{invoice.number}</Text>
            {invoice.title ? <Text style={[s.titleSub, { color: c.text, maxWidth: 220, textAlign: 'right' }]}>{invoice.title}</Text> : null}
          </View>
        </View>

        <View style={s.partiesRow}>
          <View style={s.party}>
            <Text style={s.partyLabel}>{T.customer}</Text>
            <Text style={s.partyName}>{customer.name}</Text>
            {customer.street && <Text style={s.partyDetail}>{customer.street}</Text>}
            {customer.city && <Text style={s.partyDetail}>{customer.city}</Text>}
            {customer.vat_number && <Text style={s.partyDetail}>{T.vatId}: {customer.vat_number}</Text>}
          </View>
          {(invoice.site_address || invoice.quote_number) && (
            <View style={s.party}>
              {invoice.site_address && <>
                <Text style={s.partyLabel}>{T.site}</Text>
                <Text style={[s.partyDetail, { color: c.text, fontSize: 9.5, marginBottom: 6 }]}>{invoice.site_address}</Text>
              </>}
              {invoice.quote_number && <>
                <Text style={s.partyLabel}>{T.basedOn}</Text>
                <Text style={[s.partyDetail, { color: c.text, fontSize: 9.5 }]}>{invoice.quote_number}</Text>
              </>}
            </View>
          )}
        </View>

        <View style={s.termsRow}>
          {([[T.issued, date(invoice.issue_date)], [serviceLabel, serviceValue], [T.due, date(invoice.due_date)], [T.ref, invoice.reference || '—']] as [string, string][]).map(([lbl, val], i) => (
            <View key={lbl} style={{ flex: 1, flexDirection: 'row' }}>
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
        {lines.map((l, i) => (
          <View key={i} style={[s.row, i % 2 === 1 ? { backgroundColor: c.rowAlt } : {}]} wrap={false}>
            <Text style={[s.cell, s.colPos]}>{i + 1}</Text>
            <View style={s.colName}>
              <Text style={s.cell}>{l.name}</Text>
              {l.description && <Text style={s.itemDesc}>{l.description}</Text>}
            </View>
            <Text style={[s.cell, s.colQty]}>{fmtNum(l.quantity)}</Text>
            <Text style={[s.cell, s.colUnit, { color: c.muted }]}>{UNIT[l.unit] ?? l.unit}</Text>
            <Text style={[s.cell, s.colPrice]}>{eur(l.unit_price)}</Text>
            {hasDisc && <Text style={[s.cell, s.colDisc]}>{l.discount_pct ? pct(l.discount_pct) : ''}</Text>}
            <Text style={[s.cell, s.colVat, { color: c.muted }]}>{pct(l.vat_rate)}</Text>
            <Text style={[s.cell, s.colTotal, { fontWeight: 700 }]}>{eur(l.total)}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          {snap.discount_amount > 0 && <>
            <View style={s.totLine}><Text style={s.totLabel}>{T.subtotal}</Text><Text style={s.totValue}>{eur(snap.subtotal)}</Text></View>
            <View style={s.totLine}><Text style={s.totLabel}>{T.discount} {pct(invoice.discount_pct)}</Text><Text style={s.totValue}>{eur(-snap.discount_amount)}</Text></View>
          </>}
          <View style={s.totLine}><Text style={[s.totLabel, { color: c.text, fontWeight: 700 }]}>{T.net}</Text><Text style={[s.totValue, { fontWeight: 700 }]}>{eur(snap.total_net)}</Text></View>
          {company.vat_payer && snap.vat.map(v => (
            <View key={v.rate} style={s.totLine}><Text style={s.totLabel}>{T.vatLine(pct(v.rate))} ({eur(v.base)})</Text><Text style={s.totValue}>{eur(v.amount)}</Text></View>
          ))}
          <View style={s.grandBox}>
            <Text style={s.grandLabel}>{T.gross}</Text>
            <Text style={s.grandValue}>{eur(snap.total_gross)}</Text>
          </View>
        </View>

        {!company.vat_payer && <Text style={s.legalNote}>{T.noVat}</Text>}
        {isAdvance && <Text style={s.legalNote}>{T.advanceNote}</Text>}

        {company.bank_iban && snap.total_gross > 0 && (
          <View style={s.payBox} wrap={false}>
            <View style={s.payCol}>
              <Text style={s.smallLabel}>{T.payment}</Text>
              <View style={s.payLine}><Text style={s.payLabel}>{T.recipient}</Text><Text style={s.payValue}>{company.name}</Text></View>
              <View style={s.payLine}><Text style={s.payLabel}>{T.iban}</Text><Text style={s.payValue}>{company.bank_iban}</Text></View>
              {company.bank_name && <View style={s.payLine}><Text style={s.payLabel}>{T.bank}</Text><Text style={s.payValue}>{company.bank_name}</Text></View>}
              <View style={s.payLine}><Text style={s.payLabel}>{T.ref}</Text><Text style={s.payValue}>{invoice.reference || '—'}</Text></View>
              <View style={s.payLine}><Text style={s.payLabel}>{T.amount}</Text><Text style={s.payValue}>{eur(snap.total_gross)}</Text></View>
              <View style={s.payLine}><Text style={s.payLabel}>{T.due}</Text><Text style={s.payValue}>{date(invoice.due_date)}</Text></View>
            </View>
            {qr && (
              <View>
                <Image src={qr} style={s.qr} />
                <Text style={s.qrCaption}>{T.scan}</Text>
              </View>
            )}
          </View>
        )}

        {invoice.notes && (
          <View style={s.noteBox} wrap={false}>
            <Text style={s.smallLabel}>{T.notes}</Text>
            <Text style={s.noteText}>{invoice.notes}</Text>
          </View>
        )}
        {company.invoice_note && <Text style={[s.legalNote, { color: c.muted }]}>{company.invoice_note}</Text>}

        <View style={s.footer} fixed>
          <View style={s.footerRow}>
            <View style={{ flex: 1, paddingRight: 16 }}>
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

// UPN QR as a PNG data URL (version 15, error correction M, as the standard asks)
async function upnQrImage(snap: InvoiceSnapshot): Promise<string | null> {
  const payload = upnQrPayload(snap)
  if (!payload) return null
  try { return await QRCode.toDataURL(payload, { version: 15, errorCorrectionLevel: 'M', margin: 1, width: 400 }) } catch { return null }
}

export async function invoicePdfBlob(snap: InvoiceSnapshot): Promise<Blob> {
  const qr = await upnQrImage(snap)
  return pdf(<InvoicePdf snap={snap} qr={qr} />).toBlob()
}

export async function downloadInvoicePdf(snap: InvoiceSnapshot, fileName: string) {
  const blob = await invoicePdfBlob(snap)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = fileName
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
