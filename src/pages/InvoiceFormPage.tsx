import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom'
import { ChevronLeft, Plus, Trash2, Pencil, Download, Send, Check, Ban, RotateCcw, FileText, ClipboardCheck, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import NumberInput from '../components/ui/NumberInput'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import PdfCanvas from '../components/PdfCanvas'
import { invoicePdfBlob, downloadInvoicePdf } from '../components/InvoicePdf'
import { NumCell, ServiceSearch, CustomerSearch } from './QuoteFormPage'
import { PRICE_UNITS, VAT_RATES } from './PriceListPage'
import { lineTotal } from '../lib/quoteTotals'
import {
  INVOICE_STATUS_LABEL, INVOICE_STATUS_STYLE, KIND_LABEL, buildInvoiceSnapshot, invoiceTotals, referenceFor,
  todayIso, addDaysIso, displayStatus, fmtDate,
} from '../lib/invoices'
import type { Customer, Invoice, InvoiceKind, InvoiceLine, InvoiceSnapshot, InvoiceStatus, PriceItem, PriceUnit, Job, Quote, QuoteLine } from '../types/database'

interface LineRow {
  key: string
  price_item_id: string | null
  advance_invoice_id: string | null
  name: string
  description: string
  unit: string
  quantity: number | null
  unit_price: number | null
  discount_pct: number | null
  vat_rate: number
}

let keyc = 0
const nk = () => `il${++keyc}`
const num = (l: LineRow) => ({ quantity: l.quantity ?? 0, unit_price: l.unit_price ?? 0, discount_pct: l.discount_pct ?? 0, vat_rate: l.vat_rate })
const boxCls = 'w-full text-sm border border-gray-200 rounded-lg hover:border-gray-400 px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-transparent disabled:border-transparent disabled:hover:border-transparent'
const labelCls = 'text-xs font-medium'

const L = {
  sl: {
    invoices: 'Izdani računi', newInvoice: 'Nov račun', newAdvance: 'Nov avansni račun', editInvoice: 'Uredi račun', invoice: 'Račun',
    details: 'Podatki računa', kind: 'Vrsta', customer: 'Kupec', searchCustomer: 'Išči stranko…', noMatch: 'Ni zadetkov', title: 'Naziv računa', titleHint: 'npr. Beljenje stanovanja',
    issueDate: 'Datum izdaje', serviceDate: 'Datum opravljene storitve', serviceTo: 'do (če gre za obdobje)', advanceDate: 'Datum prejema avansa', dueDate: 'Rok plačila', reference: 'Sklic',
    referenceAuto: 'Določi se ob izdaji', notes: 'Opombe', notesHint: 'Besedilo, ki se izpiše na računu',
    lines: 'Postavke', pos: 'Poz.', service: 'Storitev', searchService: 'Išči storitev…', item: 'Naziv postavke', qty: 'Kol.', unit: 'EM', price: 'Cena', disc: 'Pop. %', vat: 'DDV', amount: 'Vrednost', addLine: 'Dodaj vrstico',
    subtotal: 'Skupaj postavke', discount: 'Popust na račun', net: 'Skupaj brez DDV', vatLine: (r: string) => `DDV ${r} %`, gross: 'Za plačilo',
    saveDraft: 'Shrani kot osnutek', issue: 'Izdaj račun', saveChanges: 'Shrani spremembe', cancel: 'Prekliči', edit: 'Uredi',
    download: 'Prenesi PDF', markSent: 'Označi kot poslano', markPaid: 'Označi kot plačano', unpay: 'Vrni na neplačano', storno: 'Storniraj', del: 'Izbriši',
    tabData: 'Podatki', tabPdf: 'PDF', pdfError: 'PDF-ja ni bilo mogoče ustvariti.',
    issued: 'Račun izdan', saved: 'Shranjeno', deleted: 'Izbrisano',
    needCustomer: 'Izberite kupca.', needLines: 'Dodajte vsaj eno postavko.', noIban: 'V Nastavitvah vpišite IBAN, da bodo na računu podatki za plačilo.',
    paidTitle: 'Označi kot plačano', paidDate: 'Datum plačila', stornoTitle: 'Storniraj račun', stornoText: 'Račun bo označen kot storniran. Izdanega računa ni mogoče izbrisati — za popravek izdajte nov račun.',
    delTitle: 'Izbriši osnutek', delText: 'Ali res želite izbrisati ta osnutek računa?',
    fromQuote: 'Ponudba', fromJob: 'Delo', advancePct: 'Avans v % ponudbe', advanceLine: (n: string) => `Avans po ponudbi ${n}`,
    deduct: (n: string) => `Odbitek avansnega računa ${n}`, noVatHint: 'Niste zavezanec za DDV — DDV se ne obračuna (nastavitev v Nastavitvah).',
    paidOn: (d: string) => `Plačano ${d}`, overdueBy: (n: number) => `Zapadel pred ${n} ${n === 1 ? 'dnem' : 'dnevi'}`,
  },
  en: {
    invoices: 'Invoices', newInvoice: 'New invoice', newAdvance: 'New advance invoice', editInvoice: 'Edit invoice', invoice: 'Invoice',
    details: 'Invoice details', kind: 'Type', customer: 'Customer', searchCustomer: 'Search customers…', noMatch: 'No matches', title: 'Invoice title', titleHint: 'e.g. Painting the flat',
    issueDate: 'Issue date', serviceDate: 'Date of service', serviceTo: 'to (for a period)', advanceDate: 'Advance received on', dueDate: 'Due date', reference: 'Reference',
    referenceAuto: 'Set when issued', notes: 'Notes', notesHint: 'Text printed on the invoice',
    lines: 'Lines', pos: 'Pos.', service: 'Service', searchService: 'Search services…', item: 'Item name', qty: 'Qty', unit: 'Unit', price: 'Price', disc: 'Disc. %', vat: 'VAT', amount: 'Amount', addLine: 'Add line',
    subtotal: 'Items total', discount: 'Invoice discount', net: 'Total excl. VAT', vatLine: (r: string) => `VAT ${r} %`, gross: 'Total due',
    saveDraft: 'Save as draft', issue: 'Issue invoice', saveChanges: 'Save changes', cancel: 'Cancel', edit: 'Edit',
    download: 'Download PDF', markSent: 'Mark as sent', markPaid: 'Mark as paid', unpay: 'Mark as unpaid', storno: 'Cancel invoice', del: 'Delete',
    tabData: 'Details', tabPdf: 'PDF', pdfError: 'The PDF could not be created.',
    issued: 'Invoice issued', saved: 'Saved', deleted: 'Deleted',
    needCustomer: 'Choose a customer.', needLines: 'Add at least one line.', noIban: 'Add your IBAN in Settings so the invoice shows payment details.',
    paidTitle: 'Mark as paid', paidDate: 'Payment date', stornoTitle: 'Cancel invoice', stornoText: 'The invoice will be marked as cancelled. Issued invoices cannot be deleted — issue a new invoice to correct it.',
    delTitle: 'Delete draft', delText: 'Delete this draft invoice?',
    fromQuote: 'Quote', fromJob: 'Job', advancePct: 'Advance as % of quote', advanceLine: (n: string) => `Advance for quote ${n}`,
    deduct: (n: string) => `Deduction of advance invoice ${n}`, noVatHint: 'You are not VAT registered — no VAT is charged (see Settings).',
    paidOn: (d: string) => `Paid on ${d}`, overdueBy: (n: number) => `Overdue by ${n} ${n === 1 ? 'day' : 'days'}`,
  },
}

export default function InvoiceFormPage({ readOnly = false }: { readOnly?: boolean }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { company, hasPerm, isAdmin, loading: permLoading } = useCompany()
  const { t, lang } = useLanguage()
  const T = L[lang]
  const o = t.od
  const canEdit = hasPerm('quotes', 'create')
  const money = (n: number) => (n ?? 0).toLocaleString('de-DE', { style: 'currency', currency: company?.currency ?? 'EUR' })
  const vatPayer = company?.vat_payer ?? true
  const defaultVat = vatPayer ? 22 : 0

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [items, setItems] = useState<PriceItem[]>([])
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  // form
  const [kind, setKind] = useState<InvoiceKind>('invoice')
  const [customerId, setCustomerId] = useState('')
  const [title, setTitle] = useState('')
  const [issueDate, setIssueDate] = useState(todayIso())
  const [serviceDate, setServiceDate] = useState(todayIso())
  const [serviceTo, setServiceTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [discountPct, setDiscountPct] = useState<number | null>(0)
  const [lines, setLines] = useState<LineRow[]>([])
  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [quoteInfo, setQuoteInfo] = useState<{ number: string; total_net: number; site: string | null; vat: number } | null>(null)
  const [jobTitle, setJobTitle] = useState<string | null>(null)
  const [advancePct, setAdvancePct] = useState<number | null>(30)
  // review
  const [tab, setTab] = useState<'data' | 'pdf'>('data')
  const [paidOpen, setPaidOpen] = useState(false)
  const [paidDate, setPaidDate] = useState(todayIso())
  const [stornoOpen, setStornoOpen] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const status: InvoiceStatus = invoice?.status ?? 'draft'
  const ro = readOnly || (!!invoice && invoice.status !== 'draft')

  useEffect(() => { if (company) init() }, [company, id, readOnly])

  async function init() {
    if (!company) return
    setLoading(true)
    const [{ data: cs }, { data: ps }] = await Promise.all([
      supabase.from('customers').select('*').eq('company_id', company.id).order('name'),
      supabase.from('price_items').select('*').eq('company_id', company.id).eq('is_active', true).order('code'),
    ])
    setCustomers((cs as Customer[]) ?? []); setItems((ps as PriceItem[]) ?? [])

    if (id) {
      const [{ data: inv }, { data: ls }] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', id).single(),
        supabase.from('invoice_lines').select('*').eq('invoice_id', id).order('position'),
      ])
      if (!inv) { setLoading(false); return }
      const i = inv as Invoice
      setInvoice(i); setKind(i.kind); setCustomerId(i.customer_id ?? ''); setTitle(i.title ?? '')
      setIssueDate(i.issue_date); setServiceDate(i.service_date ?? ''); setServiceTo(i.service_date_to ?? ''); setDueDate(i.due_date ?? '')
      setNotes(i.notes ?? ''); setDiscountPct(Number(i.discount_pct) || 0); setQuoteId(i.quote_id); setJobId(i.job_id)
      setLines(((ls as InvoiceLine[]) ?? []).map(l => ({
        key: nk(), price_item_id: l.price_item_id, advance_invoice_id: l.advance_invoice_id, name: l.name, description: l.description ?? '',
        unit: l.unit, quantity: Number(l.quantity), unit_price: Number(l.unit_price), discount_pct: Number(l.discount_pct), vat_rate: Number(l.vat_rate),
      })))
      await loadLinks(i.quote_id, i.job_id)
      setLoading(false)
      return
    }

    // New invoice — prefill from a job or a quote when we came from there
    setInvoice(null); setTab('data')
    const k: InvoiceKind = params.get('kind') === 'advance' ? 'advance' : 'invoice'
    setKind(k)
    const today = todayIso()
    setIssueDate(today); setServiceDate(today); setServiceTo(''); setDueDate(addDaysIso(today, company.invoice_due_days ?? 8))
    setNotes(''); setDiscountPct(0); setTitle(''); setCustomerId('')
    let qId = params.get('quote'), jId = params.get('job')
    let job: Job | null = null
    if (jId) {
      const { data } = await supabase.from('jobs').select('*').eq('id', jId).single()
      job = data as Job | null
      if (job) {
        qId = job.quote_id ?? qId
        if (job.customer_id) setCustomerId(job.customer_id)
        if (job.title) setTitle(job.title)
        if (job.start_date) { setServiceDate(job.start_date); setServiceTo(job.end_date && job.end_date !== job.start_date ? job.end_date : '') }
      } else jId = null
    }
    setJobId(jId); setQuoteId(qId)
    const info = await loadLinks(qId, jId)

    let quote: Quote | null = null, qLines: QuoteLine[] = []
    if (qId) {
      const [{ data: q }, { data: ql }] = await Promise.all([
        supabase.from('quotes').select('*').eq('id', qId).single(),
        supabase.from('quote_lines').select('*').eq('quote_id', qId).order('position'),
      ])
      quote = q as Quote | null; qLines = (ql as QuoteLine[]) ?? []
      if (quote) {
        if (!job?.customer_id) setCustomerId(quote.customer_id)
        if (!job?.title && quote.title) setTitle(quote.title)
        // the quote's overall discount is folded into each line (below), so advance deductions are never discounted
        setDiscountPct(0)
      }
    }

    const vatOf = (v: number) => vatPayer ? v : 0
    if (k === 'advance') {
      const pctV = 30
      setAdvancePct(pctV)
      setLines([{
        key: nk(), price_item_id: null, advance_invoice_id: null, name: info.quote ? T.advanceLine(info.quote.number) : '', description: '',
        unit: 'pcs', quantity: 1, unit_price: info.quote ? Math.round(info.quote.total_net * pctV) / 100 : null, discount_pct: 0, vat_rate: vatOf(info.quote?.vat ?? 22),
      }])
    } else {
      const base: LineRow[] = qLines.length
        ? qLines.map(l => ({
            key: nk(), price_item_id: l.price_item_id, advance_invoice_id: null, name: l.name,
            description: [l.room, l.description].filter(Boolean).join(' · '), unit: l.unit,
            quantity: Number(l.quantity), unit_price: Number(l.unit_price), vat_rate: vatOf(Number(l.vat_rate)),
            discount_pct: Math.round((1 - (1 - Number(l.discount_pct) / 100) * (1 - (Number(quote?.discount_pct) || 0) / 100)) * 10000) / 100,
          }))
        : job ? [{ key: nk(), price_item_id: null, advance_invoice_id: null, name: job.title ?? '', description: '', unit: 'lump', quantity: 1, unit_price: job.value != null ? Number(job.value) : null, discount_pct: 0, vat_rate: defaultVat }]
        : [blankLine()]
      // Deduct advance invoices already issued for this quote / job (one line per VAT rate)
      const deductions = await advanceDeductions(qId, jId)
      setLines([...base, ...deductions])
    }
    setLoading(false)
  }

  async function loadLinks(qId: string | null, jId: string | null) {
    let quote: typeof quoteInfo = null
    if (qId) {
      const [{ data: q }, { data: ql }] = await Promise.all([
        supabase.from('quotes').select('quote_number, total_net, site_address').eq('id', qId).single(),
        supabase.from('quote_lines').select('vat_rate, total_net').eq('quote_id', qId),
      ])
      if (q) {
        // VAT rate with the largest share of the quote → used for an advance line
        const byRate = new Map<number, number>()
        for (const l of (ql as { vat_rate: number; total_net: number }[]) ?? []) byRate.set(Number(l.vat_rate), (byRate.get(Number(l.vat_rate)) ?? 0) + Number(l.total_net))
        const vat = [...byRate.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 22
        quote = { number: (q as Quote).quote_number, total_net: Number((q as Quote).total_net), site: (q as Quote).site_address, vat }
      }
    }
    setQuoteInfo(quote)
    if (jId) {
      const { data: j } = await supabase.from('jobs').select('title, quotes(title), customers(name)').eq('id', jId).single()
      const jj = j as { title: string | null; quotes: { title: string | null } | null; customers: { name: string } | null } | null
      setJobTitle(jj ? (jj.title ?? jj.quotes?.title ?? jj.customers?.name ?? null) : null)
    } else setJobTitle(null)
    return { quote }
  }

  async function advanceDeductions(qId: string | null, jId: string | null): Promise<LineRow[]> {
    if (!qId && !jId || !company) return []
    let q = supabase.from('invoices').select('id, invoice_number, quote_id, job_id').eq('company_id', company.id).eq('kind', 'advance').in('status', ['issued', 'sent', 'paid'])
    q = qId ? q.eq('quote_id', qId) : q.eq('job_id', jId!)
    const { data: advs } = await q
    const out: LineRow[] = []
    for (const a of (advs as { id: string; invoice_number: string }[]) ?? []) {
      const { data: al } = await supabase.from('invoice_lines').select('vat_rate, total_net').eq('invoice_id', a.id)
      const byRate = new Map<number, number>()
      for (const l of (al as { vat_rate: number; total_net: number }[]) ?? []) byRate.set(Number(l.vat_rate), (byRate.get(Number(l.vat_rate)) ?? 0) + Number(l.total_net))
      for (const [rate, net] of byRate) out.push({
        key: nk(), price_item_id: null, advance_invoice_id: a.id, name: T.deduct(a.invoice_number), description: '',
        unit: 'pcs', quantity: 1, unit_price: -Math.round(net * 100) / 100, discount_pct: 0, vat_rate: rate,
      })
    }
    return out
  }

  const blankLine = (): LineRow => ({ key: nk(), price_item_id: null, advance_invoice_id: null, name: '', description: '', unit: 'pcs', quantity: null, unit_price: null, discount_pct: 0, vat_rate: defaultVat })
  const patchLine = (key: string, p: Partial<LineRow>) => setLines(ls => ls.map(l => l.key === key ? { ...l, ...p } : l))
  function pickService(key: string, p: PriceItem) {
    patchLine(key, { price_item_id: p.id, name: p.name, description: p.description ?? '', unit: p.unit, unit_price: Number(p.price), vat_rate: vatPayer ? Number(p.vat_rate) : 0 })
  }

  function setAdvance(pctV: number | null) {
    setAdvancePct(pctV)
    if (!quoteInfo || pctV == null) return
    setLines(ls => ls.map((l, i) => i === 0 ? { ...l, unit_price: Math.round(quoteInfo.total_net * pctV) / 100 } : l))
  }

  const validLines = lines.filter(l => l.name.trim() && (l.quantity ?? 0) !== 0)
  const hasDeduction = lines.some(l => l.advance_invoice_id)
  const totals = invoiceTotals(validLines.map(l => ({ ...num(l), name: l.name, description: null, unit: l.unit })), hasDeduction ? 0 : discountPct ?? 0)

  // Insert / update the invoice and replace its lines. Returns the invoice id.
  async function persist(extra: Partial<Invoice> = {}): Promise<string | null> {
    if (!company) return null
    if (!customerId) { toast.error(T.needCustomer); return null }
    if (!validLines.length) { toast.error(T.needLines); return null }
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null
    const row = {
      kind, customer_id: customerId || null, quote_id: quoteId, job_id: jobId, title: title.trim() || null,
      issue_date: issueDate, service_date: serviceDate || null, service_date_to: serviceTo || null, due_date: dueDate || null,
      notes: notes.trim() || null, discount_pct: hasDeduction ? 0 : discountPct ?? 0,
      total_net: totals.total_net, total_vat: totals.total_vat, total_gross: totals.total_gross,
      updated_at: new Date().toISOString(), ...extra,
    }
    let invId = invoice?.id ?? null
    if (invId) {
      const { error } = await supabase.from('invoices').update(row).eq('id', invId)
      if (error) { toast.error(error.message); return null }
      await supabase.from('invoice_lines').delete().eq('invoice_id', invId)
    } else {
      const { data, error } = await supabase.from('invoices').insert({ ...row, company_id: company.id, status: 'draft', created_by: uid }).select('id').single()
      if (error || !data) { toast.error(error?.message ?? 'Error'); return null }
      invId = (data as { id: string }).id
    }
    const { error: le } = await supabase.from('invoice_lines').insert(validLines.map((l, i) => ({
      invoice_id: invId!, company_id: company.id, position: i + 1, price_item_id: l.price_item_id, advance_invoice_id: l.advance_invoice_id,
      name: l.name.trim(), description: l.description.trim() || null, unit: l.unit,
      quantity: l.quantity ?? 0, unit_price: l.unit_price ?? 0, discount_pct: l.discount_pct ?? 0, vat_rate: l.vat_rate, total_net: lineTotal(num(l)),
    })))
    if (le) { toast.error(le.message); return null }
    return invId
  }

  async function saveDraft() {
    setSaving(true)
    const invId = await persist()
    setSaving(false)
    if (!invId) return
    toast.success(T.saved); navigate('/invoices')
  }

  async function issue() {
    if (!company) return
    setSaving(true)
    const invId = await persist()
    if (!invId) { setSaving(false); return }
    const { data: number, error: ne } = await supabase.rpc('generate_invoice_number', { p_company_id: company.id })
    if (ne || !number) { setSaving(false); toast.error(ne?.message ?? 'Error'); return }
    const reference = referenceFor(number as string)
    const customer = customers.find(c => c.id === customerId) ?? null
    const snapshot = buildInvoiceSnapshot(
      { invoice_number: number as string, kind, title: title.trim() || null, issue_date: issueDate, service_date: serviceDate || null, service_date_to: serviceTo || null, due_date: dueDate || null, reference, notes: notes.trim() || null, discount_pct: hasDeduction ? 0 : discountPct ?? 0 },
      customer, company, validLines.map(l => ({ ...num(l), name: l.name.trim(), description: l.description.trim() || null, unit: l.unit })),
      { quote_number: quoteInfo?.number ?? null, site_address: quoteInfo?.site ?? null },
    )
    const { error } = await supabase.from('invoices').update({ invoice_number: number as string, reference, snapshot, status: 'issued', issued_at: new Date().toISOString() }).eq('id', invId)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(T.issued)
    navigate(`/invoices/${invId}`)
  }

  async function setStatus(next: InvoiceStatus, extra: Partial<Invoice> = {}) {
    if (!invoice) return
    const patch: Partial<Invoice> = { status: next, updated_at: new Date().toISOString(), ...extra }
    if (next === 'sent' && !invoice.sent_at) patch.sent_at = new Date().toISOString()
    const { error } = await supabase.from('invoices').update(patch).eq('id', invoice.id)
    if (error) { toast.error(error.message); return }
    setInvoice({ ...invoice, ...patch } as Invoice); toast.success(T.saved)
  }

  async function remove() {
    if (!invoice) return
    const { error } = await supabase.from('invoices').delete().eq('id', invoice.id)
    if (error) { toast.error(error.message); return }
    toast.success(T.deleted); navigate('/invoices')
  }

  async function download() {
    if (!invoice?.snapshot) return
    setDownloading(true)
    try { await downloadInvoicePdf(invoice.snapshot as InvoiceSnapshot, `Racun_${invoice.invoice_number}.pdf`) } catch (e) { console.error(e); toast.error(T.pdfError) }
    setDownloading(false)
  }

  if (!permLoading && !canEdit && !readOnly) return <Navigate to="/invoices" replace />
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  const disp = invoice ? displayStatus(invoice) : 'draft'
  const st = INVOICE_STATUS_STYLE[disp]
  const heading = invoice?.invoice_number
    ? `${KIND_LABEL[lang][kind]} ${invoice.invoice_number}`
    : invoice ? T.editInvoice : kind === 'advance' ? T.newAdvance : T.newInvoice
  const border = ro ? 'border-[#eeeff1]' : 'border-gray-200'
  const selectCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:border-[#eeeff1]'

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate('/invoices')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ChevronLeft className="w-4 h-4" />{T.invoices}</button>
      </div>

      {/* Header + actions */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">{heading}</h1>
          {invoice && <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: st.bg, border: `1px solid ${st.border}`, color: st.color }}>{INVOICE_STATUS_LABEL[lang][disp]}</span>}
          {invoice?.status === 'paid' && invoice.paid_at && <span className="text-sm text-gray-500">{T.paidOn(fmtDate(invoice.paid_at))}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!ro && <>
            {invoice && isAdmin && <Button variant="secondary" onClick={() => setDelOpen(true)} disabled={saving} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>}
            <Button variant="secondary" loading={saving} onClick={saveDraft}>{T.saveDraft}</Button>
            <Button loading={saving} onClick={issue}>{T.issue}</Button>
          </>}
          {ro && invoice && <>
            {canEdit && status === 'draft' && <Button variant="secondary" onClick={() => navigate(`/invoices/${invoice.id}/edit`)} className="gap-1.5"><Pencil className="w-3.5 h-3.5" />{T.edit}</Button>}
            {invoice.snapshot && <Button variant="secondary" className="gap-1.5" loading={downloading} onClick={download}><Download className="w-3.5 h-3.5" />{T.download}</Button>}
            {canEdit && status === 'issued' && <Button variant="secondary" onClick={() => setStatus('sent')} className="gap-1.5"><Send className="w-3.5 h-3.5" />{T.markSent}</Button>}
            {canEdit && (status === 'issued' || status === 'sent') && <Button onClick={() => { setPaidDate(todayIso()); setPaidOpen(true) }} className="gap-1.5"><Check className="w-3.5 h-3.5" />{T.markPaid}</Button>}
            {isAdmin && status === 'paid' && <Button variant="secondary" onClick={() => setStatus(invoice.sent_at ? 'sent' : 'issued', { paid_at: null })} className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" />{T.unpay}</Button>}
            {isAdmin && (status === 'issued' || status === 'sent') && <Button variant="secondary" onClick={() => setStornoOpen(true)} className="gap-1.5 text-red-600"><Ban className="w-3.5 h-3.5" />{T.storno}</Button>}
          </>}
        </div>
      </div>

      {!vatPayer && !ro && <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600">{T.noVatHint}</div>}
      {!company?.bank_iban && !ro && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{T.noIban}</div>}

      {/* Tabs (review of an issued invoice) */}
      {ro && invoice?.snapshot && (
        <div className="flex items-center gap-1 border-b border-gray-200 mb-5">
          {(['data', 'pdf'] as const).map(k => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === k ? 'border-blue-600 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {k === 'data' ? T.tabData : T.tabPdf}
            </button>
          ))}
        </div>
      )}

      {ro && tab === 'pdf' && invoice?.snapshot ? (
        <PdfCanvas makeBlob={() => invoicePdfBlob(invoice.snapshot as InvoiceSnapshot)} version={invoice.id + invoice.updated_at} errorLabel={T.pdfError} />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Details */}
          <div className={`bg-white rounded-xl border ${border} p-5`}>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="text-sm font-semibold text-gray-900">{T.details}</h2>
              {quoteId && quoteInfo && (
                <button type="button" onClick={() => navigate(`/quotes/${quoteId}`)} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-gray-200 text-xs text-gray-700 hover:bg-gray-50" style={{ backgroundColor: '#fbfbfb' }}>
                  <FileText className="w-3 h-3 text-gray-500" />{T.fromQuote} {quoteInfo.number}<ExternalLink className="w-3 h-3 text-gray-400" />
                </button>
              )}
              {jobId && (
                <button type="button" onClick={() => navigate('/jobs')} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-gray-200 text-xs text-gray-700 hover:bg-gray-50" style={{ backgroundColor: '#fbfbfb' }}>
                  <ClipboardCheck className="w-3 h-3 text-gray-500" />{T.fromJob}{jobTitle ? `: ${jobTitle}` : ''}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <label className={labelCls} style={{ color: '#7f7f7f' }}>{T.kind}</label>
                <select className={selectCls} value={kind} disabled={ro || !!invoice} onChange={e => setKind(e.target.value as InvoiceKind)}>
                  <option value="invoice">{KIND_LABEL[lang].invoice}</option>
                  <option value="advance">{KIND_LABEL[lang].advance}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1 md:col-span-1 lg:col-span-3">
                <label className={labelCls} style={{ color: '#7f7f7f' }}>{T.customer}</label>
                {ro
                  ? <div className={selectCls}>{customers.find(c => c.id === customerId)?.name ?? '—'}</div>
                  : <CustomerSearch customers={customers} value={customerId} onChange={setCustomerId} placeholder={T.searchCustomer} emptyText={T.noMatch} labels={{ person: o.typePerson, company: o.typeCompany }} />}
              </div>
              <div className="md:col-span-2 lg:col-span-4"><Input id="inv-title" label={T.title} placeholder={T.titleHint} value={title} disabled={ro} onChange={e => setTitle(e.target.value)} /></div>
              <Input id="inv-issue" type="date" label={T.issueDate} value={issueDate} disabled={ro}
                onChange={e => { const v = e.target.value; setIssueDate(v); if (v && company && !invoice) setDueDate(addDaysIso(v, company.invoice_due_days ?? 8)) }} />
              <Input id="inv-service" type="date" label={kind === 'advance' ? T.advanceDate : T.serviceDate} value={serviceDate} disabled={ro} onChange={e => setServiceDate(e.target.value)} />
              {kind === 'invoice'
                ? <Input id="inv-service-to" type="date" label={T.serviceTo} value={serviceTo} min={serviceDate || undefined} disabled={ro} onChange={e => setServiceTo(e.target.value)} />
                : <NumberInput id="inv-adv" label={T.advancePct} value={advancePct} onValue={setAdvance} unit="%" decimals={0} />}
              <Input id="inv-due" type="date" label={T.dueDate} value={dueDate} min={issueDate || undefined} disabled={ro} onChange={e => setDueDate(e.target.value)} />
              <div className="flex flex-col gap-1">
                <label className={labelCls} style={{ color: '#7f7f7f' }}>{T.reference}</label>
                <div className={`${selectCls} ${invoice?.reference ? 'text-gray-900' : 'text-gray-400'}`}>{invoice?.reference ?? T.referenceAuto}</div>
              </div>
              <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                <label htmlFor="inv-notes" className={labelCls} style={{ color: '#7f7f7f' }}>{T.notes}</label>
                <textarea id="inv-notes" rows={2} value={notes} disabled={ro} onChange={e => setNotes(e.target.value)} placeholder={T.notesHint}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50 disabled:border-[#eeeff1]" />
              </div>
            </div>
          </div>

          {/* Lines */}
          <div className={`bg-white rounded-xl border ${border} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-gray-100"><h2 className="text-sm font-semibold text-gray-900">{T.lines}</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {[T.pos, ...(ro ? [] : [T.service]), T.item, T.qty, T.unit, T.price, T.disc, T.vat, T.amount, ...(ro ? [] : [''])].map((h, i) => (
                      <th key={i} className={`px-2 py-2.5 text-xs font-medium text-gray-500 ${[T.qty, T.price, T.disc, T.amount].includes(h) ? 'text-right' : 'text-left'} ${i === 0 ? 'pl-4' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((l, i) => (
                    <tr key={l.key} className={l.advance_invoice_id ? 'bg-amber-50/40' : ''}>
                      <td className="pl-4 pr-2 py-2 text-gray-400 w-10">{i + 1}</td>
                      {!ro && <td className="px-2 py-2 w-44">{!l.advance_invoice_id && <ServiceSearch items={items} onSelect={p => pickService(l.key, p)} placeholder={T.searchService} money={money} units={o.units} />}</td>}
                      <td className="px-2 py-2 min-w-[220px]">
                        <input value={l.name} disabled={ro} placeholder={T.item} onChange={e => patchLine(l.key, { name: e.target.value })} className={`${boxCls} font-medium`} />
                        {(!ro || l.description) && <input value={l.description} disabled={ro} placeholder="—" onChange={e => patchLine(l.key, { description: e.target.value })} className={`${boxCls} mt-1 text-xs text-gray-500`} />}
                      </td>
                      <td className="px-2 py-2 w-24"><NumCell value={l.quantity} onValue={v => patchLine(l.key, { quantity: v })} disabled={ro} /></td>
                      <td className="px-2 py-2 w-24">
                        <select value={l.unit} disabled={ro} onChange={e => patchLine(l.key, { unit: e.target.value as PriceUnit })} className={boxCls}>
                          {PRICE_UNITS.map(u => <option key={u} value={u}>{o.units[u]}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2 w-28"><NumCell value={l.unit_price} onValue={v => patchLine(l.key, { unit_price: v })} disabled={ro} /></td>
                      <td className="px-2 py-2 w-20"><NumCell value={l.discount_pct} onValue={v => patchLine(l.key, { discount_pct: v })} decimals={0} disabled={ro} /></td>
                      <td className="px-2 py-2 w-24">
                        <select value={l.vat_rate} disabled={ro || !vatPayer} onChange={e => patchLine(l.key, { vat_rate: Number(e.target.value) })} className={boxCls}>
                          {VAT_RATES.map(r => <option key={r} value={r}>{String(r).replace('.', ',')} %</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2 w-28 text-right font-medium text-gray-900 whitespace-nowrap">{money(lineTotal(num(l)))}</td>
                      {!ro && <td className="pr-4 pl-1 py-2 w-10"><button type="button" onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!ro && (
              <div className="px-4 py-3 border-t border-gray-100">
                <button type="button" onClick={() => setLines(ls => [...ls, blankLine()])} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"><Plus className="w-4 h-4" />{T.addLine}</button>
              </div>
            )}

            {/* Totals */}
            <div className="border-t border-gray-200 px-5 py-4 flex justify-end">
              <div className="w-full max-w-sm flex flex-col gap-1.5 text-sm">
                {(totals.discount_amount > 0 || !ro) && (
                  <div className="flex justify-between text-gray-600"><span>{T.subtotal}</span><span>{money(totals.subtotal)}</span></div>
                )}
                {/* no invoice-wide discount next to advance deductions (it would shrink the deduction too) */}
                {!ro && !hasDeduction ? (
                  <div className="flex justify-between items-center text-gray-600">
                    <span>{T.discount}</span>
                    <div className="w-24"><NumCell value={discountPct} onValue={setDiscountPct} decimals={0} /></div>
                  </div>
                ) : totals.discount_amount > 0 && (
                  <div className="flex justify-between text-gray-600"><span>{T.discount} {discountPct} %</span><span>{money(-totals.discount_amount)}</span></div>
                )}
                <div className="flex justify-between font-medium text-gray-900"><span>{T.net}</span><span>{money(totals.total_net)}</span></div>
                {vatPayer && totals.vat.map(v => (
                  <div key={v.rate} className="flex justify-between text-gray-600"><span>{T.vatLine(String(v.rate).replace('.', ','))} ({money(v.base)})</span><span>{money(v.amount)}</span></div>
                ))}
                <div className="flex justify-between items-center mt-1 pt-2.5 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">{T.gross}</span>
                  <span className="text-lg font-semibold text-gray-900">{money(totals.total_gross)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal open={paidOpen} onClose={() => setPaidOpen(false)} title={T.paidTitle} size="sm">
        <div className="flex flex-col gap-4">
          <Input id="paid-date" type="date" label={T.paidDate} value={paidDate} onChange={e => setPaidDate(e.target.value)} />
          <div className="flex justify-end gap-3 pt-4 -mx-6 px-6 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setPaidOpen(false)}>{T.cancel}</Button>
            <Button onClick={() => { setStatus('paid', { paid_at: paidDate || todayIso() }); setPaidOpen(false) }}>{T.markPaid}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={stornoOpen} onClose={() => setStornoOpen(false)} onConfirm={() => { setStatus('cancelled'); setStornoOpen(false) }}
        title={T.stornoTitle} message={T.stornoText} confirmLabel={T.storno} danger />
      <ConfirmDialog open={delOpen} onClose={() => setDelOpen(false)} onConfirm={remove} title={T.delTitle} message={T.delText} confirmLabel={T.del} danger />
    </div>
  )
}
