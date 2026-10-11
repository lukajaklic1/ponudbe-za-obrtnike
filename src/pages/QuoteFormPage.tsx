import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ChevronLeft, Plus, Trash2, Pencil, Download, Send, Check, X, Ruler, Search, Paperclip, FileText, UploadCloud } from 'lucide-react'
import OfferPdfPreview, { downloadOfferPdf } from '../components/OfferPdfPreview'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import NumberInput from '../components/ui/NumberInput'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { buildSnapshot } from '../lib/offerSnapshot'
import { lineTotal, quoteTotals, roomAreas } from '../lib/quoteTotals'
import { PRICE_UNITS, VAT_RATES } from './PriceListPage'
import type { Customer, Quote, QuoteLine, QuoteAttachment, QuoteStatus, OfferSnapshot, PriceItem, PriceUnit } from '../types/database'
import { QuoteStatusBadge } from '../components/ui/QuoteStatusBadge'
import { INCOTERMS } from '../lib/incoterms'

interface LineRow {
  key: string
  room: string
  price_item_id: string | null
  name: string
  description: string
  unit: PriceUnit
  quantity: number | null
  unit_price: number | null
  discount_pct: number | null
  vat_rate: number
}

let keyc = 0
const nk = () => `l${++keyc}`

const boxCls = 'w-full text-sm border border-gray-200 rounded-lg hover:border-gray-400 px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-transparent disabled:border-transparent disabled:hover:border-transparent'
const num = (l: LineRow) => ({ quantity: l.quantity ?? 0, unit_price: l.unit_price ?? 0, discount_pct: l.discount_pct ?? 0, vat_rate: l.vat_rate })

// Storage keys must be plain ASCII: "Ponudba Barve Čebela.pdf" → "Ponudba_Barve_Cebela.pdf"
const safeFileName = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_')

// Compact de-DE number cell (raw while focused, formatted on blur).
function NumCell({ value, onValue, decimals = 2, disabled }: { value: number | null; onValue: (v: number | null) => void; decimals?: number; disabled?: boolean }) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const shown = focused ? draft : value == null ? '' : value.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return (
    <input value={shown} disabled={disabled} inputMode="decimal"
      onFocus={() => { setDraft(value == null ? '' : String(value).replace('.', ',')); setFocused(true) }}
      onBlur={() => setFocused(false)}
      onChange={e => {
        setDraft(e.target.value)
        const c = e.target.value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
        const n = parseFloat(c)
        onValue(c === '' || isNaN(n) ? null : n)
      }}
      className={`${boxCls} text-right`} />
  )
}

// Inline service search per line (like the catalog search on purchase orders).
function ServiceSearch({ items, onSelect, placeholder, money, units }: {
  items: PriceItem[]; onSelect: (p: PriceItem) => void; placeholder: string
  money: (n: number) => string; units: Record<string, string>
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const q = query.toLowerCase()
  const filtered = q ? items.filter(i => i.name.toLowerCase().includes(q) || (i.code ?? '').toLowerCase().includes(q)) : items
  return (
    <div className="relative">
      <div className="flex items-center gap-1 border border-gray-200 rounded-lg hover:border-gray-400 bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        <Search className="w-3 h-3 text-gray-400 shrink-0" />
        <input value={query} placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="text-xs bg-transparent outline-none flex-1 text-gray-900 placeholder:text-gray-400 min-w-0" />
        {query && <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setQuery('')}><X className="w-3 h-3 text-gray-300" /></button>}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-30 left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto max-h-60">
          {filtered.map(p => (
            <button key={p.id} type="button" onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(p); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-blue-50 transition-colors">
              {p.code && <span className="text-xs text-gray-400 shrink-0">{p.code}</span>}
              <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{p.name}</span>
              <span className="text-xs text-gray-500 whitespace-nowrap">{money(Number(p.price))} / {units[p.unit]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Customer picker: type to filter (name, e-mail, phone, city), pick from the list.
function CustomerSearch({ customers, value, onChange, placeholder, emptyText, labels }: {
  customers: Customer[]; value: string; onChange: (id: string) => void; placeholder: string; emptyText: string
  labels: { person: string; company: string }
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = customers.find(c => c.id === value)
  const q = query.toLowerCase()
  const filtered = customers
    .filter(c => (c.status ?? 'active') === 'active' || c.id === value)
    .filter(c => !q || [c.name, c.email, c.phone, c.address_city, c.contact_person].some(v => (v ?? '').toLowerCase().includes(q)))
  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input value={open ? query : (selected?.name ?? '')} placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="flex-1 min-w-0 text-sm bg-transparent outline-none text-gray-900 placeholder:text-gray-400" />
        {selected && !open && <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => onChange('')} className="text-gray-300 hover:text-gray-500"><X className="w-3.5 h-3.5" /></button>}
      </div>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto max-h-64">
          {filtered.length === 0 && <p className="px-3 py-2.5 text-sm text-gray-400">{emptyText}</p>}
          {filtered.map(c => (
            <button key={c.id} type="button" onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(c.id); setQuery(''); setOpen(false) }}
              className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors ${c.id === value ? 'bg-blue-50/60' : ''}`}>
              <div className="text-sm text-gray-900">{c.name}</div>
              <div className="text-xs text-gray-400">{[c.customer_type === 'company' ? labels.company : labels.person, c.address_city, c.email].filter(Boolean).join(' · ')}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function QuoteFormPage({ readOnly = false }: { readOnly?: boolean }) {
  const { id } = useParams()
  const editMode = !!id
  const { company, hasPerm, isAdmin } = useCompany()
  const { t, lang } = useLanguage()
  const s = t.qp
  const o = t.od
  const navigate = useNavigate()
  const cur = company?.currency ?? 'EUR'
  const money = (n: number) => (n ?? 0).toLocaleString('de-DE', { style: 'currency', currency: cur })

  const [customers, setCustomers] = useState<Customer[]>([])
  const [priceItems, setPriceItems] = useState<PriceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [quoteNumber, setQuoteNumber] = useState('')
  const [alreadySent, setAlreadySent] = useState(false)
  const [status, setStatusState] = useState<QuoteStatus>('draft')
  const [confirm, setConfirm] = useState<null | 'won' | 'lost'>(null)
  const [tab, setTab] = useState<'overview' | 'pdf'>('overview')
  const [snapshot, setSnapshot] = useState<OfferSnapshot | null>(null)
  const isSaved = !!quoteNumber
  const [customerId, setCustomerId] = useState('')
  const [title, setTitle] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [parity, setParity] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [leadTime, setLeadTime] = useState('')
  const [notes, setNotes] = useState('')
  const [discountPct, setDiscountPct] = useState<number | null>(0)
  const [lines, setLines] = useState<LineRow[]>([])
  const [deleteQuoteOpen, setDeleteQuoteOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Attachments: saved ones + files picked before the quote exists (uploaded on save)
  const [attachments, setAttachments] = useState<QuoteAttachment[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  // Room calculator
  const [roomOpen, setRoomOpen] = useState(false)
  const [room, setRoom] = useState({ name: '', length: null as number | null, width: null as number | null, height: 2.6 as number | null, openings: null as number | null, wallItem: '', ceilingItem: '' })

  // reload when switching between editor and review of the same quote (same component instance)
  useEffect(() => { if (company) { setTab('overview'); init() } }, [company, id, readOnly])

  const blankLine = (roomName = '', vat = 22): LineRow => ({ key: nk(), room: roomName, price_item_id: null, name: '', description: '', unit: 'm2', quantity: null, unit_price: null, discount_pct: 0, vat_rate: vat })

  async function init() {
    if (!company) return
    // spinner only on first load (initial state) — reloads keep the current view on screen
    const [{ data: cust }, { data: pis }] = await Promise.all([
      supabase.from('customers').select('*').eq('company_id', company.id).order('name'),
      supabase.from('price_items').select('*').eq('company_id', company.id).eq('is_active', true).order('code'),
    ])
    setCustomers((cust as Customer[]) ?? [])
    setPriceItems((pis as PriceItem[]) ?? [])

    if (editMode && id) {
      const { data: q } = await supabase.from('quotes').select('*').eq('id', id).single()
      if (q) {
        const quote = q as Quote
        setStatusState(quote.status)
        if (quote.snapshot) setSnapshot(quote.snapshot as OfferSnapshot)
        if (!readOnly && !['draft', 'issued', 'sent'].includes(quote.status)) { navigate(`/quotes/${id}`, { replace: true }); return }
        setAlreadySent(['sent', 'won', 'lost'].includes(quote.status))
        setQuoteNumber(quote.quote_number ?? '')
        setCustomerId(quote.customer_id)
        // older quotes stored the customer name as title — treat that as 'no title'
        const custName = ((cust as Customer[]) ?? []).find(c => c.id === quote.customer_id)?.name
        setTitle(quote.title && quote.title !== custName ? quote.title : '')
        setContactPerson(quote.contact_person ?? ''); setContactEmail(quote.contact_email ?? ''); setContactPhone(quote.contact_phone ?? '')
        setSiteAddress(quote.site_address ?? '')
        // a draft without payment terms picks up the company default
        setPaymentTerms(quote.payment_terms || (quote.status === 'draft' && !readOnly ? company.default_payment_terms ?? '' : ''))
        setParity(quote.parity || (quote.status === 'draft' && !readOnly ? company.default_parity ?? '' : ''))
        setValidUntil(quote.valid_until ?? ''); setLeadTime(quote.lead_time ?? ''); setNotes(quote.notes ?? '')
        setDiscountPct(Number(quote.discount_pct ?? 0))
      }
      const { data: ls } = await supabase.from('quote_lines').select('*').eq('quote_id', id).order('position')
      const loaded = ((ls as QuoteLine[]) ?? []).map(l => ({
        key: nk(), room: l.room ?? '', price_item_id: l.price_item_id, name: l.name, description: l.description ?? '',
        unit: l.unit, quantity: Number(l.quantity), unit_price: Number(l.unit_price), discount_pct: Number(l.discount_pct), vat_rate: Number(l.vat_rate),
      }))
      setLines(loaded.length || readOnly ? loaded : [blankLine()])
      const { data: att } = await supabase.from('quote_attachments').select('*').eq('quote_id', id).order('created_at')
      setAttachments((att as QuoteAttachment[]) ?? [])
    } else {
      // company defaults for a new quote
      const d = new Date(); d.setDate(d.getDate() + (company.default_valid_days || 30))
      setPaymentTerms(company.default_payment_terms ?? '')
      setParity(company.default_parity ?? '')
      setValidUntil(format(d, 'yyyy-MM-dd'))
      setLines([blankLine()])
    }
    setLoading(false)
  }

  // ── Lines ─────────────────────────────────────────────────
  const totals = useMemo(() => quoteTotals(lines.map(num), discountPct ?? 0), [lines, discountPct])
  const rooms = useMemo(() => {
    const order: string[] = []
    for (const l of lines) if (!order.includes(l.room)) order.push(l.room)
    return order
  }, [lines])
  const grouped = rooms.length > 1 || !!rooms[0]
  // follow the VAT already used on this quote (e.g. 9,5 % for home renovation)
  const currentVat = () => lines.length ? lines[lines.length - 1].vat_rate : 22

  function patchLine(key: string, patch: Partial<LineRow>) { setLines(ls => ls.map(l => l.key === key ? { ...l, ...patch } : l)) }
  function removeLine(key: string) { setLines(ls => ls.filter(l => l.key !== key)) }
  function applyService(key: string, p: PriceItem) {
    patchLine(key, { price_item_id: p.id, name: p.name, description: p.description ?? '', unit: p.unit, unit_price: Number(p.price) })
  }
  function addLine(roomName = rooms[rooms.length - 1] ?? '') {
    setLines(ls => {
      let idx = -1
      ls.forEach((l, i) => { if (l.room === roomName) idx = i })
      const row = blankLine(roomName, currentVat())
      return idx < 0 ? [...ls, row] : [...ls.slice(0, idx + 1), row, ...ls.slice(idx + 1)]
    })
  }
  function renameRoom(from: string, to: string) { setLines(ls => ls.map(l => l.room === from ? { ...l, room: to } : l)) }
  function removeRoom(name: string) { setLines(ls => ls.filter(l => l.room !== name)) }

  const areas = roomAreas(room.length ?? 0, room.width ?? 0, room.height ?? 0, room.openings ?? 0)
  const m2Items = priceItems.filter(p => p.unit === 'm2')
  function addRoom() {
    const name = room.name.trim() || `${o.room} ${rooms.filter(r => r).length + 1}`
    const vat = currentVat()
    const fromItem = (p: PriceItem, qty: number): LineRow => ({ key: nk(), room: name, price_item_id: p.id, name: p.name, description: p.description ?? '', unit: p.unit, quantity: qty, unit_price: Number(p.price), discount_pct: 0, vat_rate: vat })
    const rows: LineRow[] = []
    const w = priceItems.find(p => p.id === room.wallItem)
    const c = priceItems.find(p => p.id === room.ceilingItem)
    if (w) rows.push(fromItem(w, areas.walls))
    if (c) rows.push(fromItem(c, areas.ceiling))
    if (!rows.length) rows.push({ ...blankLine(name, vat), quantity: areas.walls || null })
    // drop the untouched starter line so the quote doesn't keep an empty row
    setLines(ls => [...ls.filter(l => l.name.trim() || l.quantity || l.unit_price), ...rows])
    setRoomOpen(false)
    setRoom(r => ({ ...r, name: '', length: null, width: null, openings: null }))
  }

  // ── Attachments ───────────────────────────────────────────
  const canAddFiles = !readOnly
  const canDeleteFiles = !readOnly   // while editing (any status); the review page is view/download only

  function addFiles(list: FileList | null) {
    if (!list) return
    const files = Array.from(list)
    if (id) uploadFiles(id, files)
    else setNewFiles(f => [...f, ...files])
  }

  async function uploadFiles(quoteId: string, files: File[]) {
    if (!company || !files.length) return
    setUploading(true)
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null
    const added: QuoteAttachment[] = []
    for (const file of files) {
      const path = `${company.id}/quotes/${quoteId}/${Date.now()}_${safeFileName(file.name)}`
      const { error } = await supabase.storage.from('quotations').upload(path, file)
      if (error) { toast.error(`${file.name}: ${error.message}`); continue }
      const { data, error: dbErr } = await supabase.from('quote_attachments').insert({
        company_id: company.id, quote_id: quoteId, quote_item_id: null, file_name: file.name,
        file_size: file.size, storage_path: path, thumb_path: null, kind: 'other', uploaded_by: uid,
      }).select().single()
      if (dbErr) { toast.error(dbErr.message); continue }
      added.push(data as QuoteAttachment)
    }
    setAttachments(a => [...a, ...added])
    setUploading(false)
  }

  async function openFile(att: QuoteAttachment, download = false) {
    const { data, error } = await supabase.storage.from('quotations').createSignedUrl(att.storage_path, 3600, download ? { download: att.file_name } : undefined)
    if (error || !data?.signedUrl) { toast.error(error?.message ?? 'Error'); return }
    if (download) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = att.file_name; a.click() }
    else window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function deleteFile(att: QuoteAttachment) {
    await supabase.storage.from('quotations').remove([att.storage_path])
    const { error } = await supabase.from('quote_attachments').delete().eq('id', att.id)
    if (error) { toast.error(error.message); return }
    setAttachments(a => a.filter(x => x.id !== att.id))
  }

  // ── Persistence ───────────────────────────────────────────
  async function persist(): Promise<{ id: string; number: string } | null> {
    if (!company || !customerId) { toast.error(o.pickCustomer); return null }
    const fields = {
      customer_id: customerId, title: title.trim(),
      // contact details come from the customer record
      contact_person: contactPerson.trim() || null, contact_email: contactEmail.trim() || null, contact_phone: contactPhone.trim() || null,
      site_address: siteAddress.trim() || null, payment_terms: paymentTerms.trim() || null, parity: parity || null,
      valid_until: validUntil || null, lead_time: leadTime.trim() || null, delivery_date: null, notes: notes.trim() || null,
      discount_pct: discountPct ?? 0, total_net: totals.total_net, total_vat: totals.total_vat, total_gross: totals.total_gross,
    }
    let quoteId = id
    let number = quoteNumber
    if (editMode && id) {
      const { error } = await supabase.from('quotes').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) { toast.error(error.message); return null }
    } else {
      const { data: qnum, error: ne } = await (supabase as any).rpc('generate_quote_number', { p_company_id: company.id })
      if (ne) { toast.error(ne.message); return null }
      const me = (await supabase.auth.getUser()).data.user!.id
      const { data: created, error } = await supabase.from('quotes').insert({
        ...fields, company_id: company.id, quote_number: qnum, status: 'draft',
        created_by: me, assignee_id: me,
      } as any).select('id').single()
      if (error) { toast.error(error.message); return null }
      quoteId = (created as { id: string }).id
      number = qnum as string
    }

    // Lines: replace the whole set (simple + keeps positions consistent)
    const { error: delErr } = await supabase.from('quote_lines').delete().eq('quote_id', quoteId!)
    if (delErr) { toast.error(delErr.message); return null }
    const rows = lines.filter(l => l.name.trim() || l.quantity || l.unit_price).map((l, i) => ({
      quote_id: quoteId!, company_id: company.id, position: i + 1, room: l.room.trim() || null,
      price_item_id: l.price_item_id, name: l.name.trim() || `#${i + 1}`, description: l.description.trim() || null,
      unit: l.unit, quantity: l.quantity ?? 0, unit_price: l.unit_price ?? 0, discount_pct: l.discount_pct ?? 0, vat_rate: l.vat_rate,
      total_net: lineTotal(num(l)),
    }))
    if (rows.length) {
      const { error } = await supabase.from('quote_lines').insert(rows)
      if (error) { toast.error(error.message); return null }
    }

    if (newFiles.length) { await uploadFiles(quoteId!, newFiles); setNewFiles([]) }
    return { id: quoteId!, number }
  }

  async function save() {
    setSaving(true)
    const res = await persist()
    setSaving(false)
    if (!res) return
    toast.success(o.draftSaved)
    // drafts are reopened from the list (click → editor)
    navigate('/quotes')
  }

  // Issue (or re-issue after edits): save, freeze a snapshot for the PDF, go to read-only review.
  async function issue() {
    if (!company) return
    if (!lines.some(l => (l.quantity ?? 0) > 0 && (l.unit_price ?? 0) > 0)) { toast.error(o.noLinesToIssue); return }
    setSaving(true)
    const res = await persist()
    if (!res) { setSaving(false); return }
    const cust = customers.find(c => c.id === customerId) ?? null
    const snap = buildSnapshot({
      quote_number: res.number, title: title.trim(), valid_until: validUntil || null, lead_time: leadTime || null, payment_terms: paymentTerms || null, parity: parity || null,
      contact_person: contactPerson.trim() || null, contact_email: contactEmail.trim() || null, contact_phone: contactPhone.trim() || null,
      notes: notes || null, site_address: siteAddress || null, discount_pct: discountPct ?? 0,
    } as Quote, cust, company, lines.filter(l => l.name.trim() || l.quantity || l.unit_price).map(l => ({ room: l.room.trim() || null, name: l.name, description: l.description || null, unit: l.unit, ...num(l) })))
    const newStatus = status === 'sent' ? 'sent' : 'issued'
    const { error } = await supabase.from('quotes').update({ snapshot: snap, status: newStatus, issued_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any).eq('id', res.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setStatusState(newStatus); setSnapshot(snap)
    toast.success(s.offerIssued)
    navigate(`/quotes/${res.id}`)
  }

  async function downloadPdf() {
    if (!snapshot) return
    setDownloading(true)
    try { await downloadOfferPdf(snapshot, lang, `Ponudba_${quoteNumber}.pdf`) }
    catch (e) { console.error('offer pdf download', e); toast.error(o.pdfError) }
    setDownloading(false)
  }

  async function changeStatus(next: QuoteStatus) {
    if (!id) return
    const patch: Partial<Quote> = { status: next, updated_at: new Date().toISOString() }
    if (next === 'sent') patch.sent_at = new Date().toISOString()
    const { error } = await supabase.from('quotes').update(patch).eq('id', id)
    if (error) { toast.error(error.message); return }
    setStatusState(next); setAlreadySent(['sent', 'won', 'lost'].includes(next)); toast.success(t.common.saved)
  }

  async function deleteQuote() {
    if (!id) return
    if (attachments.length) await supabase.storage.from('quotations').remove(attachments.map(a => a.storage_path))
    const { error } = await supabase.from('quotes').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(t.common.deleted); navigate('/quotes')
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  if (!readOnly && company && !hasPerm('quotes', 'create')) return <Navigate to="/quotes" replace />

  const ro = readOnly
  const border = ro ? 'border-[#eeeff1]' : 'border-gray-200'
  const selectedCustomer = customers.find(c => c.id === customerId)
  const companyTerms = (company?.payment_terms_list ?? []) as string[]
  const termOptions = paymentTerms && !companyTerms.includes(paymentTerms) ? [...companyTerms, paymentTerms] : companyTerms
  const colCount = ro ? 8 : 10

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate('/quotes')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ChevronLeft className="w-4 h-4" />{s.quotes}</button>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">{ro ? s.reviewTitle : (editMode ? s.editQuote : s.newQuote)}</h1>
          {quoteNumber && <span className="text-sm" style={{ color: '#7f7f7f' }}>{quoteNumber}</span>}
          {isSaved && <QuoteStatusBadge status={status} label={s.status[status]} />}
        </div>
        <div className="flex flex-wrap gap-2">
          {!ro && <>
            {isSaved && isAdmin && status === 'draft' && <Button variant="secondary" onClick={() => setDeleteQuoteOpen(true)} disabled={saving} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>}
            {status !== 'draft' && <Button variant="secondary" onClick={() => navigate(`/quotes/${id}`)} disabled={saving}>{t.common.cancel}</Button>}
            {status === 'draft'
              ? <><Button variant="secondary" loading={saving} onClick={save} disabled={!customerId}>{o.saveAsDraft}</Button>
                  <Button loading={saving} onClick={issue} disabled={!customerId}>{s.issueOffer}</Button></>
              : <Button loading={saving} onClick={issue} disabled={!customerId}>{s.saveChanges}</Button>}
          </>}
          {ro && <>
            {hasPerm('quotes', 'create') && ['draft', 'issued', 'sent'].includes(status) &&
              <Button variant="secondary" onClick={() => navigate(`/quotes/${id}/edit`)} className="gap-1.5"><Pencil className="w-3.5 h-3.5" />{s.editOffer}</Button>}
            {hasPerm('quotes', 'create') && status === 'draft' &&
              <Button loading={saving} onClick={issue} disabled={!customerId}>{s.issueOffer}</Button>}
            {status !== 'draft' && snapshot?.lines &&
              <Button variant="secondary" className="gap-1.5" loading={downloading} onClick={downloadPdf}><Download className="w-3.5 h-3.5" />{s.downloadPdf}</Button>}
            {hasPerm('quotes', 'create') && status === 'issued' && <Button onClick={() => changeStatus('sent')} className="gap-1.5"><Send className="w-3.5 h-3.5" />{s.markSentLabel}</Button>}
            {hasPerm('quotes', 'create') && status === 'sent' && <>
              <Button onClick={() => setConfirm('won')} className="gap-1.5"><Check className="w-3.5 h-3.5" />{s.markAccepted}</Button>
              <Button variant="secondary" onClick={() => setConfirm('lost')} className="gap-1.5"><X className="w-3.5 h-3.5" />{s.markRejected}</Button>
            </>}
            {(status === 'won' || status === 'lost') && isAdmin &&
              <Button variant="secondary" onClick={() => changeStatus('sent')} className="gap-1.5">{s.adminRevert}</Button>}
          </>}
        </div>
      </div>

      {!ro && alreadySent && <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{s.alreadySent}</div>}

      {/* PDF tab only once the offer is issued (a draft has no PDF yet) */}
      {ro && status !== 'draft' && snapshot?.lines && (
        <div className="flex items-center gap-1 border-b border-gray-200 mb-5">
          {([['overview', s.tabOverview], ['pdf', s.tabPdf]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{label}</button>
          ))}
        </div>
      )}

      {tab === 'overview' ? (<>
        {/* ── Quote details ─────────────────────────────── */}
        <div className={`bg-white rounded-xl border p-6 mb-5 ${border}`}>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{o.quoteDetails}</h2>
          <fieldset disabled={ro} className="contents">
            <div className="mb-4"><Input id="q-title" label={o.quoteTitle} placeholder={ro ? '' : o.quoteTitleHint} value={title} onChange={e => setTitle(e.target.value)} /></div>
          </fieldset>
          <fieldset disabled={ro} className="contents">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[#7f7f7f]">{s.customer}</label>
                {ro
                  ? <div className="rounded-lg border px-3 py-2 text-sm" style={{ backgroundColor: '#f9fafb', borderColor: '#eeeff1', color: '#52525b' }}>{selectedCustomer?.name ?? '—'}</div>
                  : <CustomerSearch customers={customers} value={customerId} placeholder={o.searchCustomer} emptyText={o.noCustomerMatch}
                      labels={{ person: o.typePerson, company: o.typeCompany }}
                      onChange={cid => {
                        setCustomerId(cid)
                        const c = customers.find(x => x.id === cid)
                        setContactPerson(c ? (c.contact_person ?? (c.customer_type === 'company' ? '' : c.name)) : '')
                        setContactEmail(c?.email ?? ''); setContactPhone(c?.phone ?? '')
                        if (c && !siteAddress) setSiteAddress([c.address_street, [c.address_postal_code, c.address_city].filter(Boolean).join(' ')].filter(Boolean).join(', '))
                      }} />}
                {!ro && customers.length === 0 && <button type="button" onClick={() => navigate('/customers')} className="text-xs text-blue-600 text-left hover:underline">{o.addCustomerFirst}</button>}
              </div>
              {/* Customer details — contact fields editable per quote, VAT / address belong to the customer */}
              <Input id="q-contact" label={s.contactPerson} value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
              <Input id="q-email" label={t.common.email} type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
              <Input id="q-phone" label={t.common.phone} value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
              {selectedCustomer?.customer_type === 'company' && (
                <Input id="q-vat" label={s.vatNumber} value={selectedCustomer.vat_number ?? ''} disabled readOnly />
              )}
              <div className={selectedCustomer?.customer_type === 'company' ? '' : 'lg:col-span-2'}>
                <Input id="q-caddr" label={o.customerAddress} disabled readOnly
                  value={selectedCustomer ? [selectedCustomer.address_street, [selectedCustomer.address_postal_code, selectedCustomer.address_city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''} />
              </div>
              <Input id="q-site" label={o.siteAddress} placeholder={ro ? '' : o.siteAddressHint} value={siteAddress} onChange={e => setSiteAddress(e.target.value)} />
              <Input id="q-valid" label={s.validUntil} type={ro ? 'text' : 'date'}
                value={ro ? (validUntil ? format(new Date(validUntil), 'd. M. yyyy') : '') : validUntil}
                onChange={e => setValidUntil(e.target.value)} />
              <Input id="q-lead" label={o.executionTime} placeholder={ro ? '' : o.executionTimeHint} value={leadTime} onChange={e => setLeadTime(e.target.value)} />
              <div className="lg:col-span-2 flex flex-col gap-1">
                <label className="text-xs font-medium text-[#7f7f7f]">{s.paymentTerms}</label>
                {ro
                  ? <div className="rounded-lg border px-3 py-2 text-sm min-h-[38px]" style={{ backgroundColor: '#f9fafb', borderColor: '#eeeff1', color: '#52525b' }}>{paymentTerms || '—'}</div>
                  : termOptions.length === 0
                    ? <button type="button" onClick={() => navigate('/settings')} className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-blue-600 text-left hover:bg-blue-50/40">{o.addTermsInSettings}</button>
                    : <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">{o.none}</option>
                        {termOptions.map(term => <option key={term} value={term}>{term}</option>)}
                      </select>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[#7f7f7f]">{o.parity}</label>
                <select value={parity} onChange={e => setParity(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-[#52525b] disabled:border-[#eeeff1]">
                  <option value="">{o.none}</option>
                  {INCOTERMS.map(i => <option key={i.code} value={i.code}>{i.code} · {i.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1 mt-4">
              <label className="text-xs font-medium text-[#7f7f7f]">{s.notes}</label>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder={ro ? '' : o.notesHint}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50 disabled:text-[#52525b] disabled:border-[#eeeff1]" />
            </div>
          </fieldset>

          {/* Attachments — plain list: open / download / delete (delete only while draft) */}
          <div className="mt-5">
            <p className="text-xs font-medium text-[#7f7f7f] flex items-center gap-1.5 mb-2"><Paperclip className="w-3.5 h-3.5" />{o.attachments}</p>
            {attachments.map(att => (
              <div key={att.id} className="flex items-center gap-2 px-3 py-2 bg-[#eff5fe] border border-[#deeafd] rounded-lg mb-2">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <button type="button" onClick={() => openFile(att)} className="text-sm text-blue-600 hover:underline font-medium flex-1 text-left truncate">{att.file_name}</button>
                {att.file_size != null && <span className="text-xs text-gray-400 shrink-0">{Math.max(1, Math.round(att.file_size / 1024))} KB</span>}
                <button type="button" onClick={() => openFile(att, true)} title={o.download} className="p-1 text-gray-400 hover:text-gray-700 shrink-0"><Download className="w-4 h-4" /></button>
                {canDeleteFiles && <button type="button" onClick={() => deleteFile(att)} title={t.common.delete} className="p-1 text-gray-400 hover:text-red-500 shrink-0"><X className="w-4 h-4" /></button>}
              </div>
            ))}
            {newFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg mb-2">
                <FileText className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-sm text-green-700 font-medium flex-1 truncate">{f.name}</span>
                <span className="text-xs text-green-600 shrink-0">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                <button type="button" onClick={() => setNewFiles(fs => fs.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-red-500 shrink-0"><X className="w-4 h-4" /></button>
              </div>
            ))}
            {ro && attachments.length === 0 && <p className="text-sm text-gray-400">{o.noAttachments}</p>}
            {canAddFiles && (
              <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50/40 transition-colors w-full">
                <UploadCloud className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-500">{uploading ? o.uploading : o.attachHint}</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden" disabled={uploading}
                  onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
              </label>
            )}
          </div>
        </div>

        {/* ── Lines ─────────────────────────────────────── */}
        <div className={`bg-white rounded-xl border overflow-hidden mb-5 ${border}`}>
          <div className={`flex items-center justify-between gap-2 px-6 py-3 border-b ${ro ? 'border-[#eeeff1]' : 'border-gray-100'}`}>
            <h2 className="text-sm font-semibold text-gray-700">{o.lines}</h2>
            {!ro && <Button variant="secondary" size="sm" onClick={() => setRoomOpen(true)} className="gap-1.5"><Ruler className="w-3.5 h-3.5" />{o.addRoom}</Button>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead className={`bg-gray-50 border-b ${border}`}><tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-12">{o.pos}</th>
                {!ro && <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 w-48">{o.service}</th>}
                <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500">{o.itemName}</th>
                <th className="text-right px-2 py-2.5 text-xs font-medium text-gray-500 w-24">{o.qty}</th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 w-24">{o.unit}</th>
                <th className="text-right px-2 py-2.5 text-xs font-medium text-gray-500 w-28">{o.unitPrice}</th>
                <th className="text-right px-2 py-2.5 text-xs font-medium text-gray-500 w-20">{o.discount}</th>
                <th className="text-right px-2 py-2.5 text-xs font-medium text-gray-500 w-24">{o.vat}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-32">{o.lineTotal}</th>
                {!ro && <th className="w-10" />}
              </tr></thead>
              {(() => { let pos = 0; return rooms.map(rn => {
                const rl = lines.filter(l => l.room === rn)
                const sub = rl.reduce((a, l) => a + lineTotal(num(l)), 0)
                return (
                  <tbody key={rn || '__general'} className={`divide-y ${ro ? 'divide-[#eeeff1]' : 'divide-gray-100'}`}>
                    {grouped && (
                      <tr className="bg-[#fbfbfb]">
                        <td colSpan={colCount - (ro ? 1 : 2)} className="px-4 py-2">
                          {ro
                            ? <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">{rn || o.general}</span>
                            : <input defaultValue={rn} placeholder={o.general} onBlur={e => e.target.value !== rn && renameRoom(rn, e.target.value)}
                                className="text-xs font-semibold uppercase tracking-wide text-gray-700 bg-transparent px-1 py-0.5 -ml-1 rounded border border-transparent hover:border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />}
                        </td>
                        <td className="px-4 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">{money(sub)}</td>
                        {!ro && <td className="px-2 py-2 text-right">
                          <button title={t.common.delete} onClick={() => removeRoom(rn)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>}
                      </tr>
                    )}
                    {rl.map(l => { pos++; return (
                      <tr key={l.key} className="align-top">
                        <td className="px-4 py-2.5 pt-4 text-xs text-gray-400">{pos}</td>
                        {!ro && <td className="px-2 py-2.5">
                          <ServiceSearch items={priceItems} onSelect={p => applyService(l.key, p)} placeholder={o.searchService} money={money} units={o.units} />
                        </td>}
                        <td className="px-2 py-2.5">
                          {ro ? <div className="pt-1.5"><div className="text-gray-900 font-medium">{l.name}</div>{l.description && <div className="text-xs text-gray-400">{l.description}</div>}</div>
                            : <>
                              <input value={l.name} placeholder={o.itemNamePlaceholder} onChange={e => patchLine(l.key, { name: e.target.value })}
                                className="w-full text-sm border-0 bg-transparent outline-none text-gray-900 placeholder:text-gray-400 font-medium focus:ring-0 pt-1.5" />
                              <input value={l.description} placeholder={o.descriptionOptional} onChange={e => patchLine(l.key, { description: e.target.value })}
                                className="w-full text-xs border-0 bg-transparent outline-none text-gray-400 placeholder:text-gray-300 focus:ring-0 mt-0.5" />
                            </>}
                        </td>
                        <td className="px-2 py-2.5"><NumCell value={l.quantity} disabled={ro} onValue={v => patchLine(l.key, { quantity: v })} /></td>
                        <td className="px-2 py-2.5">
                          <select value={l.unit} disabled={ro} onChange={e => patchLine(l.key, { unit: e.target.value as PriceUnit })} className={boxCls}>
                            {PRICE_UNITS.map(u => <option key={u} value={u}>{o.units[u]}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2.5"><NumCell value={l.unit_price} disabled={ro} onValue={v => patchLine(l.key, { unit_price: v })} /></td>
                        <td className="px-2 py-2.5"><NumCell value={l.discount_pct} decimals={0} disabled={ro} onValue={v => patchLine(l.key, { discount_pct: v })} /></td>
                        <td className="px-2 py-2.5">
                          <select value={l.vat_rate} disabled={ro} onChange={e => patchLine(l.key, { vat_rate: Number(e.target.value) })} className={`${boxCls} text-right`}>
                            {VAT_RATES.map(v => <option key={v} value={v}>{v.toLocaleString('de-DE')} %</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2.5 pt-4 text-right font-medium text-gray-800 whitespace-nowrap">{money(lineTotal(num(l)))}</td>
                        {!ro && <td className="px-2 py-2.5 pt-3.5">
                          <button type="button" onClick={() => removeLine(l.key)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>}
                      </tr>
                    ) })}
                    {!ro && grouped && (
                      <tr><td colSpan={colCount} className="px-4 py-1.5 text-right">
                        <button type="button" onClick={() => addLine(rn)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"><Plus className="w-3.5 h-3.5" />{o.addLine}</button>
                      </td></tr>
                    )}
                  </tbody>
                )
              }) })()}
              {!ro && !grouped && (
                <tbody><tr>
                  <td colSpan={colCount} className="px-4 py-2 border-t border-gray-100 text-right">
                    <button type="button" onClick={() => addLine()} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"><Plus className="w-4 h-4" />{o.addLine}</button>
                  </td>
                </tr></tbody>
              )}
              {ro && lines.length === 0 && (
                <tbody><tr><td colSpan={colCount} className="px-4 py-8 text-center text-sm text-gray-400">{o.noLines}</td></tr></tbody>
              )}

              {/* Totals */}
              <tfoot className={`border-t ${border} bg-gray-50`}>
                <tr>
                  <td colSpan={colCount - (ro ? 1 : 2)} className="px-4 pt-3 pb-1 text-right text-sm text-gray-500">{o.subtotal}</td>
                  <td className="px-4 pt-3 pb-1 text-right text-sm text-gray-700 whitespace-nowrap">{money(totals.subtotal)}</td>
                  {!ro && <td />}
                </tr>
                {/* read-only: no discount → no row (nothing to show) */}
                {(!ro || totals.discount_amount > 0) && <tr>
                  <td colSpan={colCount - (ro ? 1 : 2)} className="px-4 py-1.5 text-right text-sm text-gray-500">{o.quoteDiscount}</td>
                  <td className="px-4 py-1.5 text-right">
                    {ro ? <span className="text-sm text-gray-700">{totals.discount_amount > 0 ? `${(discountPct ?? 0).toLocaleString('de-DE')} % (−${money(totals.discount_amount)})` : ''}</span>
                      : <div className="w-28 ml-auto"><NumberInput unit="%" value={discountPct} onValue={setDiscountPct} /></div>}
                  </td>
                  {!ro && <td />}
                </tr>}
                <tr>
                  <td colSpan={colCount - (ro ? 1 : 2)} className="px-4 py-1.5 text-right text-sm font-medium text-gray-700">{o.totalNet}</td>
                  <td className="px-4 py-1.5 text-right text-sm font-medium text-gray-900 whitespace-nowrap">{money(totals.total_net)}</td>
                  {!ro && <td />}
                </tr>
                {totals.vat.map(v => (
                  <tr key={v.rate}>
                    <td colSpan={colCount - (ro ? 1 : 2)} className="px-4 py-1 text-right text-sm text-gray-500">{o.vat} {v.rate.toLocaleString('de-DE')} % ({money(v.base)})</td>
                    <td className="px-4 py-1 text-right text-sm text-gray-700 whitespace-nowrap">{money(v.amount)}</td>
                    {!ro && <td />}
                  </tr>
                ))}
                <tr className={`border-t-2 ${border}`}>
                  <td colSpan={colCount - (ro ? 1 : 2)} className="px-4 py-3 text-right text-sm font-bold text-gray-900">{o.totalGross}</td>
                  <td className="px-4 py-3 text-right text-base font-bold text-blue-600 whitespace-nowrap">{money(totals.total_gross)}</td>
                  {!ro && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </>) : (
        snapshot?.lines ? (
          <OfferPdfPreview snap={snapshot} lang={lang} errorLabel={o.pdfError} />
        ) : <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">{s.saveQuoteFirst}</div>
      )}

      {/* Room calculator */}
      <Modal open={roomOpen} onClose={() => setRoomOpen(false)} title={o.roomCalculator} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Input id="r-name" label={o.roomName} placeholder={o.roomNameHint} value={room.name} onChange={e => setRoom(r => ({ ...r, name: e.target.value }))} /></div>
          <NumberInput label={o.length} unit="m" value={room.length} onValue={v => setRoom(r => ({ ...r, length: v }))} />
          <NumberInput label={o.width} unit="m" value={room.width} onValue={v => setRoom(r => ({ ...r, width: v }))} />
          <NumberInput label={o.height} unit="m" value={room.height} onValue={v => setRoom(r => ({ ...r, height: v }))} />
          <NumberInput label={o.openings} unit="m²" value={room.openings} onValue={v => setRoom(r => ({ ...r, openings: v }))} />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {([[o.wallsArea, areas.walls, 'm²'], [o.ceilingArea, areas.ceiling, 'm²'], [o.perimeter, areas.perimeter, 'm']] as [string, number, string][]).map(([lbl, v, u]) => (
            <div key={lbl} className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
              <div className="text-xs text-gray-500">{lbl}</div>
              <div className="text-base font-semibold text-gray-900">{v.toLocaleString('de-DE', { maximumFractionDigits: 2 })} {u}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {([['wallItem', o.wallsWork], ['ceilingItem', o.ceilingWork]] as const).map(([k, lbl]) => (
            <div key={k} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#7f7f7f]">{lbl}</label>
              <select value={room[k]} onChange={e => setRoom(r => ({ ...r, [k]: e.target.value }))}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{o.none}</option>
                {m2Items.map(p => <option key={p.id} value={p.id}>{p.name} · {money(Number(p.price))}</option>)}
              </select>
            </div>
          ))}
        </div>
        {m2Items.length === 0 && <p className="text-xs text-gray-400 mt-2">{o.roomNoPriceItems}</p>}
        <div className="flex justify-end gap-3 mt-5 pt-4 -mx-6 px-6 border-t border-gray-200">
          <Button variant="secondary" onClick={() => setRoomOpen(false)}>{t.common.cancel}</Button>
          <Button onClick={addRoom} disabled={!room.length || !room.width}>{o.addRoomLines}</Button>
        </div>
      </Modal>

      <ConfirmDialog open={deleteQuoteOpen} onClose={() => setDeleteQuoteOpen(false)}
        onConfirm={() => { setDeleteQuoteOpen(false); deleteQuote() }}
        title={s.quotes} message={s.deleteQuoteConfirm} confirmLabel={t.common.delete} danger />

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => { if (confirm) changeStatus(confirm); setConfirm(null) }}
        title={confirm === 'lost' ? s.markRejected : s.markAccepted}
        message={confirm === 'lost' ? s.confirmLost : s.confirmWon}
        confirmLabel={confirm === 'lost' ? s.markRejected : s.markAccepted} danger={confirm === 'lost'} />
    </div>
  )
}
