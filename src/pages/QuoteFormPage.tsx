import { useEffect, useMemo, useRef, useState } from 'react'
import Select from '../components/ui/Select'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ChevronLeft, ChevronDown, Plus, Trash2, Pencil, Download, Check, X, Search, Paperclip, FileText, UploadCloud, Send } from 'lucide-react'
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
import { advanceTotal, lineTotal, quoteTotals, roomAreas } from '../lib/quoteTotals'
import { PRICE_UNITS, VAT_RATES } from '../lib/quoteTotals'
import { isService, serviceLine, SERVICE_GROUPS, WL, type WindowOption } from '../lib/windows'
import { COUNTRIES } from '../lib/siPosts'
import { windowFromConfigurator } from '../lib/legacyWindow'
import { ConfiguratorCore, PostFields, isUsable, type ConfigData, type ConfigItem, type ConfiguredWindow } from './ConfiguratorPage'
import SpecDrawing from '../components/SpecDrawing'
import WindowDrawing from '../components/WindowDrawing'
import RoofWindowDrawing from '../components/RoofWindowDrawing'
import SillIcon from '../components/SillIcon'
import ShadingIcon from '../components/ShadingIcon'
import WindowCalcTable from '../components/WindowCalcTable'
import { calcWindowItem, type RawSystem } from '../lib/windowCalc'
import type { Customer, Quote, QuoteLine, QuoteAttachment, QuoteStatus, OfferSnapshot, PriceItem, PriceUnit } from '../types/database'
import { QuoteStatusBadge } from '../components/ui/QuoteStatusBadge'
import { isNewEnquiry, notifyQuotesChanged } from '../lib/newEnquiry'
import { isDraftLike, isOpenOffer } from '../lib/quoteStatus'
import { INCOTERMS } from '../lib/incoterms'
import { leadSourceOptions } from '../lib/leadSources'

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
  /** frozen configurator data; kept as-is when the line is saved again */
  config: Record<string, unknown> | null
}

/** a window from the configurator: the whole configuration + every choice in words (for the quote and its PDF) */
interface WindowConfig { kind: 'window'; uid?: string; item: ConfigItem; title: string; rows: [string, string][]; template?: string | null }
/** a sill / shading / insect screen of a window, its own priced line right after the window */
interface SubConfig { kind: 'sub'; parent: string; code: string; title: string; rows: [string, string][]; image_url?: string | null; sill?: string | null; shade?: string | null; color?: string | null }
const subCfg = (l: { config: Record<string, unknown> | null }) => (l.config?.kind === 'sub' ? l.config as unknown as SubConfig : null)
const uid = () => Math.random().toString(36).slice(2, 10)
/** a service computed from the windows (installation, removal, finishing, transport, roof window work) */
interface ServiceConfig { kind: 'service'; option_id: string; auto?: boolean }
const windowCfg = (l: { config: Record<string, unknown> | null }) => (l.config?.kind === 'window' ? l.config as unknown as WindowConfig : null)
const serviceCfg = (l: { config: Record<string, unknown> | null }) => (l.config?.kind === 'service' ? l.config as unknown as ServiceConfig : null)


let keyc = 0
const nk = () => `l${++keyc}`

const boxCls = 'w-full text-sm border border-gray-200 rounded-lg hover:border-gray-400 px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-transparent disabled:border-transparent disabled:hover:border-transparent'
const num = (l: LineRow) => ({ quantity: l.quantity ?? 0, unit_price: l.unit_price ?? 0, discount_pct: l.discount_pct ?? 0, vat_rate: l.vat_rate })

// Storage keys must be plain ASCII: "Ponudba Barve Čebela.pdf" → "Ponudba_Barve_Cebela.pdf"
export const safeFileName = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_')

// Compact de-DE number cell (raw while focused, formatted on blur).
export function NumCell({ value, onValue, decimals = 2, disabled }: { value: number | null; onValue: (v: number | null) => void; decimals?: number; disabled?: boolean }) {
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
export function ServiceSearch({ items, onSelect, placeholder, money, units }: {
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
              className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-gray-50 transition-colors">
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
export function CustomerSearch({ customers, value, onChange, placeholder, emptyText, labels }: {
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
              className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors ${c.id === value ? 'bg-gray-50' : ''}`}>
              <div className="text-sm text-gray-900">{c.name}</div>
              <div className="text-xs text-gray-400">{[c.customer_type === 'company' ? labels.company : labels.person, c.address_city, c.email].filter(Boolean).join(' · ')}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** the stored address text (street, postal code town[, country]) back into fields */
function parseSite(v: string) {
  const parts = v.split(',').map(x => x.trim()).filter(Boolean)
  let country = 'SI'
  const last = parts[parts.length - 1]?.toLowerCase()
  const hit = COUNTRIES.find(c => c.sl.toLowerCase() === last || c.en.toLowerCase() === last)
  if (hit && parts.length > 1) { country = hit.code; parts.pop() }
  const m = parts.length > 1 ? /^(\d{4,5})\s+(.+)$/.exec(parts[parts.length - 1]) : null
  if (m) { parts.pop(); return { street: parts.join(', '), postal: m[1], city: m[2], country } }
  return { street: parts.join(', '), postal: '', city: '', country }
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
  const [confirm, setConfirm] = useState<null | 'won' | 'lost' | 'measure' | 'sent' | 'back' | 'issue'>(null)
  const [backStatus, setBackStatus] = useState<'sent' | 'downloaded'>('sent')   // where Izmera goes back to: sent by the supplier, or downloaded by the customer
  const [tab, setTab] = useState<'overview' | 'pdf'>('overview')
  const [snapshot, setSnapshot] = useState<OfferSnapshot | null>(null)
  // The PDF always shows the company's current logo (old logo files are deleted on replace)
  const pdfSnap = useMemo(() => snapshot ? { ...snapshot, company: { ...snapshot.company, logo_url: company?.logo_url ?? null } } : null, [snapshot, company?.logo_url])
  const isSaved = !!quoteNumber
  const [customerId, setCustomerId] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  // address of the works: street, postal code, town, country, like the configurator; stored in one text the same way the enquiry does it
  // edits of the customer's own data (name, VAT, address) are written back to the customer when the quote is saved
  const [custDirty, setCustDirty] = useState(false)
  // the customer's own data is always editable (the edit is written back to the customer on save)
  const custEdit = true
  const [site, setSite] = useState({ street: '', postal: '', city: '', country: 'SI' })
  const siteAddress = [site.street.trim(), [site.postal.trim(), site.city.trim()].filter(Boolean).join(' '), site.country !== 'SI' ? (COUNTRIES.find(c => c.code === site.country)?.sl ?? site.country) : ''].filter(Boolean).join(', ')
  const setSiteAddress = (v: string) => setSite(parseSite(v))
  const [paymentTerms, setPaymentTerms] = useState('')
  const [parity, setParity] = useState('')
  const [leadSource, setLeadSource] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [leadTime, setLeadTime] = useState('')
  const [notes, setNotes] = useState('')
  const [discountPct, setDiscountPct] = useState<number | null>(0)
  // discount when the customer pays the whole quote in advance; the quote shows both prices
  const [advancePct, setAdvancePct] = useState<number | null>(null)
  const [reverseCharge, setReverseCharge] = useState(false)   // obrnjena davčna obveznost: VAT 0 % and a note on the offer
  const [lines, setLines] = useState<LineRow[]>([])
  const [deleteQuoteOpen, setDeleteQuoteOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Attachments: saved ones + files picked before the quote exists (uploaded on save)
  const [attachments, setAttachments] = useState<QuoteAttachment[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  // Window configurator inside the quote: the same data and prices as the customer's configurator
  const [cfg, setCfg] = useState<ConfigData | null>(null)
  const [cfgOpen, setCfgOpen] = useState<null | { key?: string; items?: ConfigItem[] }>(null)
  useEffect(() => {
    if (!cfgOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCfgOpen(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cfgOpen])
  // services the user picked (the rest — work on sills, shading … — follows the installation by itself)
  const [chosenServices, setChosenServices] = useState<string[]>([])
  // the profiles at their purchase prices: the open calculation of every window is worked out from them
  const [rawSystems, setRawSystems] = useState<RawSystem[]>([])

  // Room calculator
  const [roomOpen, setRoomOpen] = useState(false)
  const [room, setRoom] = useState({ name: '', length: null as number | null, width: null as number | null, height: 2.6 as number | null, openings: null as number | null, wallItem: '', ceilingItem: '' })

  // reload when switching between editor and review of the same quote (same component instance)
  useEffect(() => { if (company) { setTab('overview'); init() } }, [company, id, readOnly])

  const blankLine = (roomName = '', vat = 22): LineRow => ({ key: nk(), config: null, room: roomName, price_item_id: null, name: '', description: '', unit: 'pcs', quantity: null, unit_price: null, discount_pct: 0, vat_rate: vat })

  async function init() {
    if (!company) return
    // spinner only on first load (initial state) — reloads keep the current view on screen
    const [{ data: cust }, { data: pis }] = await Promise.all([
      supabase.from('customers').select('*').eq('company_id', company.id).order('name'),
      // services and extras come from the price list (Cenik); % extras only make sense on a window
      supabase.from('window_options' as any).select('*').eq('company_id', company.id).eq('is_active', true).neq('pricing', 'percent').order('group_key').order('sort_order'),
    ])
    setCustomers((cust as Customer[]) ?? [])
    ;(supabase as any).rpc('get_configurator_internal').then(({ data: cd }: { data: ConfigData | null }) => setCfg(isUsable(cd) ? cd : null))
    ;(supabase as any).from('window_systems').select('*').eq('company_id', company.id).then(({ data: sy }: { data: RawSystem[] | null }) => setRawSystems(sy ?? []))
    const unitOf: Record<string, PriceUnit> = { piece: 'pcs', m2: 'm2', perimeter: 'm', width: 'm', flat: 'lump' }
    const opts = ((pis ?? []) as unknown as { id: string; name: string; description: string | null; pricing: string; price: number; group_key: string }[])
    // services first, then window extras
    opts.sort((a, b) => Number(isService(b as never)) - Number(isService(a as never)))
    setPriceItems(opts.map(o => ({ id: o.id, company_id: company.id, code: null, name: o.name, description: o.description, category: null, unit: unitOf[o.pricing] ?? 'pcs', price: Number(o.price), vat_rate: 22, is_active: true } as unknown as PriceItem)))

    if (editMode && id) {
      const { data: q } = await supabase.from('quotes').select('*').eq('id', id).single()
      if (q) {
        const quote = q as Quote
        setStatusState(quote.status); setBackStatus(quote.sent_at ? 'sent' : 'downloaded')
        if (quote.snapshot) setSnapshot(quote.snapshot as OfferSnapshot)
        // opening an enquiry from the configurator: it is no longer new
        if (isNewEnquiry(quote)) {
          supabase.from('quotes').update({ viewed_at: new Date().toISOString() } as any).eq('id', quote.id).then(() => notifyQuotesChanged())
        }
        if (!readOnly && !['enquiry', 'measure', 'draft', 'issued', 'sent', 'downloaded'].includes(quote.status)) { navigate(`/quotes/${id}`, { replace: true }); return }
        setAlreadySent(['sent', 'downloaded', 'measure', 'won', 'lost'].includes(quote.status))
        setQuoteNumber(quote.quote_number ?? '')
        setCustomerId(quote.customer_id)
        setContactPerson(quote.contact_person ?? ''); setContactEmail(quote.contact_email ?? ''); setContactPhone(quote.contact_phone ?? '')
        setSiteAddress(quote.site_address ?? '')
        // a draft without payment terms picks up the company default
        setPaymentTerms(quote.payment_terms || (isDraftLike(quote.status) && !readOnly ? company.default_payment_terms ?? '' : ''))
        setParity(quote.parity || (isDraftLike(quote.status) && !readOnly ? company.default_parity ?? '' : ''))
        setLeadSource(quote.lead_source ?? '')
        setValidUntil(quote.valid_until ?? ''); setLeadTime(quote.lead_time ?? ''); setNotes(quote.notes ?? '')
        setDiscountPct(Number(quote.discount_pct ?? 0))
        // a draft without it picks up the company default
        setReverseCharge(!!quote.reverse_charge)
        setAdvancePct(quote.advance_discount_pct != null ? Number(quote.advance_discount_pct) : isDraftLike(quote.status) && !readOnly ? Number(company.advance_discount_pct ?? 3) : null)
      }
      const { data: ls } = await supabase.from('quote_lines').select('*').eq('quote_id', id).order('position')
      const loaded = ((ls as QuoteLine[]) ?? []).map(l => ({
        key: nk(), config: (l.config as Record<string, unknown> | null) ?? null, room: l.room ?? '', price_item_id: l.price_item_id, name: l.name, description: l.description ?? '',
        unit: l.unit, quantity: Number(l.quantity), unit_price: Number(l.unit_price), discount_pct: Number(l.discount_pct), vat_rate: Number(l.vat_rate),
      }))
      setLines(loaded)
      setChosenServices(loaded.map(l => serviceCfg(l)).filter((c): c is ServiceConfig => !!c && !c.auto).map(c => c.option_id))
      const { data: att } = await supabase.from('quote_attachments').select('*').eq('quote_id', id).order('created_at')
      setAttachments((att as QuoteAttachment[]) ?? [])
    } else {
      // company defaults for a new quote
      const d = new Date(); d.setDate(d.getDate() + (company.default_valid_days || 30))
      setPaymentTerms(company.default_payment_terms ?? '')
      setParity(company.default_parity ?? '')
      setAdvancePct(Number(company.advance_discount_pct ?? 3))
      setValidUntil(format(d, 'yyyy-MM-dd'))
      setLines([])
      setChosenServices([])
    }
    setLoading(false)
  }

  // ── Lines ─────────────────────────────────────────────────
  const totals = useMemo(() => quoteTotals(lines.map(num), discountPct ?? 0), [lines, discountPct])
  const advanceGross = advanceTotal(totals.total_gross, advancePct)
  // VAT: 9,5% when the windows are installed for a private person (home renovation), otherwise 22%; 0 for a company outside the VAT system
  const installing = (cfg?.options ?? []).some(o => isService(o) && o.group_key === 'installation' && chosenServices.includes(o.id))
  const isPerson = customers.find(c => c.id === customerId)?.customer_type === 'person'
  const vatTarget = company?.vat_payer === false ? 0 : installing && isPerson ? 9.5 : 22
  const currentVat = () => manualVat ?? vatTarget
  // a VAT rate set by hand for the odd case (all lines the same, different from the automatic one); null = automatic again
  const manualVat = lines.length > 0 && lines.every(l => l.vat_rate === lines[0].vat_rate) && lines[0].vat_rate !== vatTarget ? lines[0].vat_rate : null
  function setVatRate(rate: number | null) {
    const r = rate ?? vatTarget
    setLines(ls => ls.map(l => ({ ...l, vat_rate: r })))
  }
  const windowLines = lines.filter(l => windowCfg(l))
  const serviceLines = lines.filter(l => serviceCfg(l))
  const sl = lang !== 'en'
  const subLines = lines.filter(l => subCfg(l))
  const subsOf = (l: LineRow) => { const u = windowCfg(l)?.uid; return u ? subLines.filter(x => subCfg(x)!.parent === u) : [] }
  const freeLines = lines.filter(l => !windowCfg(l) && !serviceCfg(l) && !subCfg(l))
  // the open calculation of every window (purchase prices, margins, how the price per piece comes out)
  const calcs = useMemo(() => Object.fromEntries(lines.filter(l => windowCfg(l)).map(l => [l.key, calcWindowItem(windowCfg(l)!.item, company?.window_pricing ?? null, rawSystems, lang === 'en' ? 'en' : 'sl')])),
    [lines, rawSystems, company?.window_pricing, lang])
  /** a window with the sills / shading that are priced as lines of their own */
  const positionTotal = (l: LineRow) => lineTotal(num(l)) + subsOf(l).reduce((a, x) => a + lineTotal(num(x)), 0)
  const rooms = useMemo(() => {
    const order: string[] = []
    for (const l of lines) if (!windowCfg(l) && !serviceCfg(l) && !subCfg(l) && !order.includes(l.room)) order.push(l.room)
    return order
  }, [lines])

  // ── Windows from the configurator ─────────────────────────
  function addWindows(ws: ConfiguredWindow[], replaceKey?: string) {
    const vat = currentVat()
    const rows: LineRow[] = ws.flatMap(w => {
      const u = uid()
      const win: LineRow = {
        key: nk(), room: '', price_item_id: null, name: w.title,
        description: w.rows.filter(([l]) => l !== '').slice(0, 2).map(([, v]) => v).join(' · '),
        unit: 'pcs', quantity: w.item.quantity, unit_price: w.unitPrice ?? 0, discount_pct: 0, vat_rate: vat,
        config: { kind: 'window', uid: u, item: w.item, title: w.title, rows: w.rows, template: cfg?.types.find(t => t.id === w.item.type_id)?.template ?? null } as unknown as Record<string, unknown>,
      }
      const subs: LineRow[] = (w.subs ?? []).map(sb => ({
        key: nk(), room: '', price_item_id: null, name: sb.title, description: sb.rows.map(([k, v]) => `${k}: ${v}`).join(' · '),
        unit: 'pcs', quantity: w.item.quantity, unit_price: sb.unitPrice, discount_pct: 0, vat_rate: vat,
        config: { kind: 'sub', parent: u, code: sb.code, title: sb.title, rows: sb.rows, image_url: sb.image_url ?? null, sill: sb.sill ?? null, shade: sb.shade ?? null, color: sb.color ?? null } as unknown as Record<string, unknown>,
      }))
      return [win, ...subs]
    })
    setLines(ls => {
      if (!replaceKey) {
        // windows (with their sub-positions) go before the services and the free lines
        const lastWin = ls.reduce((a, l, i) => (windowCfg(l) || subCfg(l) ? i : a), -1)
        return [...ls.slice(0, lastWin + 1), ...rows, ...ls.slice(lastWin + 1)]
      }
      const i = ls.findIndex(l => l.key === replaceKey)
      if (i < 0) return [...ls, ...rows]
      const oldUid = windowCfg(ls[i])?.uid
      // keep a discount the user set on the position
      rows[0] = { ...rows[0], discount_pct: ls[i].discount_pct, vat_rate: ls[i].vat_rate }
      const rest = ls.filter((l, j) => j !== i && !(oldUid && subCfg(l)?.parent === oldUid))
      // the window and its sub-positions come after everything before it, so they go back at the same place
      return [...rest.slice(0, i), ...rows, ...rest.slice(i)]
    })
    setCfgOpen(null)
  }

  // ── Services: computed from the windows, like in the customer's configurator ──
  const svcOptions = useMemo(() => (cfg?.options ?? []).filter(o => isService(o)), [cfg])
  /** what a service costs for all the windows of the quote, so every choice shows its amount before it is picked */
  const svcAmount = (o: WindowOption) => serviceLine(o, windowLines.map(l => {
    const it = windowCfg(l)!.item
    return { width: it.width ?? 0, height: it.height ?? 0, quantity: l.quantity ?? 0, base: l.unit_price ?? 0, roof: !!it.roof,
      sills: (it.sills?.in ? 1 : 0) + (it.sills?.out ? 1 : 0), shades: it.shading?.shade ? 1 : 0, screens: it.shading?.screen ? 1 : 0 }
  })).total
  const computedServices = useMemo((): LineRow[] => {
    if (!cfg) return []
    const wins = windowLines.map(l => {
      const it = windowCfg(l)!.item
      return { width: it.width ?? 0, height: it.height ?? 0, quantity: l.quantity ?? 0, base: l.unit_price ?? 0, roof: !!it.roof,
        sills: (it.sills?.in ? 1 : 0) + (it.sills?.out ? 1 : 0), shades: it.shading?.shade ? 1 : 0, screens: it.shading?.screen ? 1 : 0 }
    })
    const auto = (o: WindowOption) => !!o.per_item && o.per_item !== 'window' && o.per_item !== 'roof'
    const old = new Map(serviceLines.map(l => [serviceCfg(l)!.option_id, l]))
    return svcOptions.filter(o => (auto(o) ? installing : chosenServices.includes(o.id)))
      .map(o => ({ o, r: serviceLine(o, wins) }))
      .filter(({ o, r }) => r.qty > 0 || o.pricing === 'flat' || o.pricing === 'percent')
      .map(({ o, r }) => {
        const unit: PriceUnit = Number(o.price_piece ?? 0) > 0 || (o.per_item && o.per_item !== 'window') ? 'pcs'
          : o.pricing === 'piece' ? 'pcs' : o.pricing === 'm2' ? 'm2' : o.pricing === 'perimeter' || o.pricing === 'width' ? 'm' : 'lump'
        const prev = old.get(o.id)
        return { key: prev?.key ?? nk(), room: '', price_item_id: null, name: o.name, description: o.description ?? '', unit,
          quantity: r.qty, unit_price: r.unitPrice, discount_pct: prev?.discount_pct ?? 0, vat_rate: prev?.vat_rate ?? currentVat(),
          config: { kind: 'service', option_id: o.id, auto: auto(o) } as unknown as Record<string, unknown> }
      })
  }, [cfg, svcOptions, chosenServices, JSON.stringify(windowLines.map(l => [l.quantity, l.unit_price, l.config]))])
  // windows that came in through the customer's configurator become real window positions, so "Uredi okno" opens the configurator
  useEffect(() => {
    if (!cfg || loading) return
    setLines(ls => {
      let changed = false
      const out = ls.map(l => { const c = windowFromConfigurator(l, cfg, sl, nk, uid); if (!c) return l; changed = true; return { ...l, config: c } })
      return changed ? out : ls
    })
  }, [cfg, loading, lines.length])
  // keep the service lines in step with the windows (only when something really changed)
  useEffect(() => {
    if (readOnly || !cfg) return
    const sig = (ls: LineRow[]) => JSON.stringify(ls.map(l => [l.name, l.quantity, l.unit_price, l.unit, l.config]))
    if (sig(computedServices) === sig(serviceLines)) return
    setLines(ls => [...ls.filter(l => !serviceCfg(l)), ...computedServices])
  }, [computedServices])
  const vatSeen = useRef<number | null>(null)
  useEffect(() => {
    if (loading || readOnly || !cfg) return
    if (vatSeen.current === null) { vatSeen.current = vatTarget; return }
    if (vatSeen.current === vatTarget) return
    const prevTarget = vatSeen.current
    vatSeen.current = vatTarget
    if (!lines.every(l => l.vat_rate === prevTarget)) return   // a rate set by hand stays
    setLines(ls => ls.map(l => ({ ...l, vat_rate: vatTarget })))
    toast.success(lang === 'en' ? `VAT set to ${vatTarget.toLocaleString('de-DE')}% on all lines.` : `DDV na vseh postavkah je zdaj ${vatTarget.toLocaleString('de-DE')}%.`)
  }, [vatTarget, loading, cfg])
  function toggleService(o: WindowOption) {
    setChosenServices(sv => {
      if (sv.includes(o.id)) return sv.filter(x => x !== o.id)
      // one way of installation at a time
      const same = o.group_key === 'installation' ? svcOptions.filter(x => x.group_key === 'installation').map(x => x.id) : []
      return [...sv.filter(x => !same.includes(x)), o.id]
    })
  }
  // general items are one plain list: no rooms
  const grouped = false

  function patchLine(key: string, patch: Partial<LineRow>) { setLines(ls => ls.map(l => l.key === key ? { ...l, ...patch } : l)) }
  function removeLine(key: string) {
    setLines(ls => {
      const u = windowCfg(ls.find(l => l.key === key) ?? { config: null })?.uid
      return ls.filter(l => l.key !== key && !(u && subCfg(l)?.parent === u))
    })
  }
  function applyService(key: string, p: PriceItem) {
    // price list entries are not price_items rows, so the line keeps no reference
    patchLine(key, { price_item_id: null, name: p.name, description: p.description ?? '', unit: p.unit, unit_price: Number(p.price) })
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
    const fromItem = (p: PriceItem, qty: number): LineRow => ({ key: nk(), config: null, room: name, price_item_id: p.id, name: p.name, description: p.description ?? '', unit: p.unit, quantity: qty, unit_price: Number(p.price), discount_pct: 0, vat_rate: vat })
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
  function editCust(patch: Partial<Customer>) {
    setCustomers(list => list.map(c => {
      if (c.id !== customerId) return c
      const n = { ...c, ...patch }
      // a person is named by first and last name
      if (n.customer_type === 'person' && ('first_name' in patch || 'last_name' in patch)) {
        n.name = [n.first_name, n.last_name].filter(Boolean).join(' ').trim() || n.name
        setContactPerson(n.name)
      }
      return n
    }))
    setCustDirty(true)
  }

  async function persist(): Promise<{ id: string; number: string } | null> {
    if (!company || !customerId) { toast.error(o.pickCustomer); return null }
    if (custDirty) {
      const c = customers.find(x => x.id === customerId)
      if (c) {
        const { error } = await supabase.from('customers').update({
          name: c.name, first_name: c.first_name, last_name: c.last_name, vat_number: c.vat_number,
          address_street: c.address_street, address_postal_code: c.address_postal_code, address_city: c.address_city, country: c.country ?? 'SI',
          address: [c.address_street, [c.address_postal_code, c.address_city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null,
        } as any).eq('id', c.id)
        if (error) { toast.error(error.message); return null }
        setCustDirty(false)
      }
    }
    if (!leadSource) { toast.error(lang === 'en' ? 'Choose the sales channel.' : 'Izberite prodajni kanal.'); return null }
    const fields = {
      // windows: no quote title in the UI; the required DB column gets the customer name
      customer_id: customerId, title: customers.find(c => c.id === customerId)?.name ?? '',
      // contact details come from the customer record
      contact_person: contactPerson.trim() || null, contact_email: contactEmail.trim() || null, contact_phone: contactPhone.trim() || null,
      site_address: siteAddress.trim() || null, payment_terms: paymentTerms.trim() || null, parity: parity || null, lead_source: leadSource || null,
      valid_until: validUntil || null, lead_time: leadTime.trim() || null, delivery_date: null, notes: notes.trim() || null,
      discount_pct: discountPct ?? 0, advance_discount_pct: advancePct || null, reverse_charge: reverseCharge, total_net: totals.total_net, total_vat: totals.total_vat, total_gross: totals.total_gross,
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
      total_net: lineTotal(num(l)), config: l.config,
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
      quote_number: res.number, title: '', valid_until: validUntil || null, lead_time: leadTime || null, payment_terms: paymentTerms || null, parity: parity || null,
      contact_person: contactPerson.trim() || null, contact_email: contactEmail.trim() || null, contact_phone: contactPhone.trim() || null,
      notes: notes || null, site_address: siteAddress || null, discount_pct: discountPct ?? 0, advance_discount_pct: advancePct || null, reverse_charge: reverseCharge,
    } as Quote, cust, company, lines.filter(l => l.name.trim() || l.quantity || l.unit_price).map(l => ({ room: l.room.trim() || null, name: l.name, description: l.description || null, unit: l.unit, ...num(l), config: l.config })))
    // issuing locks the offer (Izdano); "Označi kot poslano" then marks it as sent to the customer.
    // An offer that was already sent (or downloaded, or is in measurement) and is issued again keeps that status.
    const newStatus: QuoteStatus = status === 'sent' || status === 'downloaded' || status === 'measure' ? status : 'issued'
    const now = new Date().toISOString()
    const { error } = await supabase.from('quotes').update({ snapshot: snap, status: newStatus, issued_at: now, updated_at: now } as any).eq('id', res.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setStatusState(newStatus); setSnapshot(snap)
    toast.success(s.offerIssued)
    navigate(`/quotes/${res.id}`)
  }

  async function downloadPdf() {
    if (!snapshot) return
    setDownloading(true)
    try { await downloadOfferPdf(pdfSnap ?? snapshot, lang, `Ponudba_${quoteNumber}.pdf`) }
    catch (e) { console.error('offer pdf download', e); toast.error(o.pdfError) }
    setDownloading(false)
  }

  async function changeStatus(next: QuoteStatus) {
    if (!id) return
    const patch: Partial<Quote> = { status: next, updated_at: new Date().toISOString() }
    if (next === 'sent') patch.sent_at = new Date().toISOString()
    const { error } = await supabase.from('quotes').update(patch).eq('id', id)
    if (error) { toast.error(error.message); return }
    setStatusState(next); setAlreadySent(['sent', 'downloaded', 'measure', 'won', 'lost'].includes(next)); toast.success(t.common.saved); notifyQuotesChanged()
  }

  async function deleteQuote() {
    if (!id) return
    if (attachments.length) await supabase.storage.from('quotations').remove(attachments.map(a => a.storage_path))
    const { error } = await supabase.from('quotes').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(t.common.deleted); navigate('/quotes')
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" /></div>
  if (!readOnly && company && !hasPerm('quotes', 'create')) return <Navigate to="/quotes" replace />

  const ro = readOnly
  const border = ro ? 'border-[#eeeff1]' : 'border-gray-200'
  const selectedCustomer = customers.find(c => c.id === customerId)
  const custAddr = selectedCustomer ? [selectedCustomer.address_street, [selectedCustomer.address_postal_code, selectedCustomer.address_city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''
  const companyTerms = (company?.payment_terms_list ?? []) as string[]
  const termOptions = paymentTerms && !companyTerms.includes(paymentTerms) ? [...companyTerms, paymentTerms] : companyTerms
  const colCount = ro ? 8 : 10

  return (
    <div className="px-6 py-6">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate('/quotes')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ChevronLeft className="w-4 h-4" />{s.quotes}</button>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:flex-1 min-w-0">
          <h1 className="text-2xl leading-8 font-bold tracking-[-0.02em] text-gray-900">{ro ? s.reviewTitle : (editMode ? s.editQuote : s.newQuote)}</h1>
          {quoteNumber && <span className="text-sm" style={{ color: '#5e5e5e' }}>{quoteNumber}</span>}
          {isSaved && <QuoteStatusBadge status={status} label={s.status[status]} />}
        </div>
        <div className="flex flex-wrap gap-2">
          {!ro && <>
            {isSaved && isAdmin && isDraftLike(status) && <Button variant="secondary" onClick={() => setDeleteQuoteOpen(true)} disabled={saving} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>}
            {!isDraftLike(status) && <Button variant="secondary" onClick={() => navigate(`/quotes/${id}`)} disabled={saving}>{t.common.cancel}</Button>}
            {isDraftLike(status)
              ? <><Button variant="secondary" loading={saving} onClick={save} disabled={!customerId}>{o.saveAsDraft}</Button>
                  <Button loading={saving} onClick={() => setConfirm('issue')} disabled={!customerId}>{s.issueOffer}</Button></>
              : <Button loading={saving} onClick={issue} disabled={!customerId}>{s.saveChanges}</Button>}
          </>}
          {ro && <>
            {hasPerm('quotes', 'create') && ['enquiry', 'measure', 'draft', 'issued', 'sent', 'downloaded'].includes(status) &&
              <Button variant="secondary" onClick={() => navigate(`/quotes/${id}/edit`)} className="gap-1.5"><Pencil className="w-3.5 h-3.5" />{s.editOffer}</Button>}
            {hasPerm('quotes', 'create') && isDraftLike(status) &&
              <Button loading={saving} onClick={() => setConfirm('issue')} disabled={!customerId}>{s.issueOffer}</Button>}
            {!isDraftLike(status) && snapshot?.lines &&
              <Button variant="secondary" className="gap-1.5" loading={downloading} onClick={downloadPdf}><Download className="w-3.5 h-3.5" />{s.downloadPdf}</Button>}
            {hasPerm('quotes', 'create') && status === 'issued' &&
              <Button onClick={() => setConfirm('sent')} className="gap-1.5"><Send className="w-3.5 h-3.5" />{s.markSentLabel}</Button>}
            {hasPerm('quotes', 'create') && isOpenOffer(status) && <>
              {status === 'measure' && <Button variant="secondary" onClick={() => setConfirm('back')} className="gap-1.5">{backStatus === 'sent' ? (sl ? 'Vrni v Poslano' : 'Back to Sent') : (sl ? 'Vrni v Preneseno' : 'Back to Downloaded')}</Button>}
              {status !== 'measure' && <Button variant="secondary" onClick={() => setConfirm('measure')} className="gap-1.5">{sl ? 'Premakni v izmero' : 'Move to measurement'}</Button>}
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
      {ro && !isDraftLike(status) && snapshot?.lines && (
        <div className="flex items-center gap-1 border-b border-gray-200 mb-5">
          {([['overview', s.tabOverview], ['pdf', s.tabPdf]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-blue-600 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{label}</button>
          ))}
        </div>
      )}

      {tab === 'overview' ? (<div className="xl:grid xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-6 xl:items-start"><div className="min-w-0">
        {/* ── Quote details ─────────────────────────────── */}
        <div className={`bg-white rounded-xl border p-6 mb-5 ${border}`}>
          <h2 className="text-[22px] leading-7 tracking-[-0.02em] font-semibold text-gray-900 mb-4">{lang === 'en' ? 'Customer details' : 'Podatki stranke'}</h2>
          <fieldset disabled={ro} className="contents">
          </fieldset>
          <fieldset disabled={ro} className="contents">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[#7f7f7f]">{s.customer}</label>
                {ro
                  ? <div className="rounded-lg border px-3 py-2 text-sm" style={{ backgroundColor: '#f9fafb', borderColor: '#eeeff1', color: '#5e5e5e' }}>{selectedCustomer?.name ?? '—'}</div>
                  : <CustomerSearch customers={customers} value={customerId} placeholder={o.searchCustomer} emptyText={o.noCustomerMatch}
                      labels={{ person: o.typePerson, company: o.typeCompany }}
                      onChange={cid => {
                        setCustomerId(cid)
                        const c = customers.find(x => x.id === cid)
                        setContactPerson(c ? (c.contact_person ?? (c.customer_type === 'company' ? '' : c.name)) : '')
                        setContactEmail(c?.email ?? ''); setContactPhone(c?.phone ?? '')
                        if (c && !siteAddress) setSiteAddress([c.address_street, [c.address_postal_code, c.address_city].filter(Boolean).join(' ')].filter(Boolean).join(', '))
                      }} />}
                {!ro && customers.length === 0 && <button type="button" onClick={() => navigate('/customers')} className="text-xs text-gray-900 text-left hover:underline">{o.addCustomerFirst}</button>}
              </div>
              {(selectedCustomer?.customer_type === 'company'
                ? <>
                  <Input id="q-cname" disabled={!custEdit} label={lang === 'en' ? 'Company name' : 'Naziv podjetja'} value={selectedCustomer.name} onChange={e => editCust({ name: e.target.value })} />
                  <Input id="q-vat" disabled={!custEdit} label={s.vatNumber} value={selectedCustomer.vat_number ?? ''} onChange={e => editCust({ vat_number: e.target.value })} />
                  <Input id="q-contact" label={s.contactPerson} value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                </>
                : <>
                  <Input id="q-first" disabled={!selectedCustomer} label={lang === 'en' ? 'First name' : 'Ime'} value={selectedCustomer?.first_name ?? ''} onChange={e => editCust({ first_name: e.target.value })} />
                  <Input id="q-last" disabled={!selectedCustomer} label={lang === 'en' ? 'Last name' : 'Priimek'} value={selectedCustomer?.last_name ?? ''} onChange={e => editCust({ last_name: e.target.value })} />
                </>)}
              <Input id="q-email" label={t.common.email} type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
              <Input id="q-phone" label={t.common.phone} value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
              <div className="lg:col-span-3 text-sm font-semibold text-gray-900 pt-2 flex items-center justify-between gap-3">
                <span>{lang === 'en' ? 'Customer address' : 'Naslov stranke'}</span>
              </div>
              <div className="lg:col-span-3"><Input id="q-cstreet" label={lang === 'en' ? 'Street and house number' : 'Ulica in hišna številka'} disabled={!selectedCustomer || !custEdit} value={selectedCustomer?.address_street ?? ''} onChange={e => editCust({ address_street: e.target.value })} /></div>
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!selectedCustomer || ro || !custEdit || (selectedCustomer.country ?? 'SI') !== 'SI'
                  ? <>
                    <Input id="q-cpostal" label={lang === 'en' ? 'Postal code' : 'Poštna številka'} disabled={!selectedCustomer || !custEdit} value={selectedCustomer?.address_postal_code ?? ''} onChange={e => editCust({ address_postal_code: e.target.value })} />
                    <Input id="q-ccity" label={lang === 'en' ? 'Town' : 'Kraj'} disabled={!selectedCustomer || !custEdit} value={selectedCustomer?.address_city ?? ''} onChange={e => editCust({ address_city: e.target.value })} />
                  </>
                  : <PostFields postalLabel={lang === 'en' ? 'Postal code' : 'Poštna številka'} cityLabel={lang === 'en' ? 'Town' : 'Kraj'} code={selectedCustomer.address_postal_code ?? ''} city={selectedCustomer.address_city ?? ''}
                      onChange={(address_postal_code, address_city) => editCust({ address_postal_code, address_city })} />}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[#7f7f7f]">{lang === 'en' ? 'Country' : 'Država'}</label>
                  <Select value={selectedCustomer?.country ?? 'SI'} onChange={v => editCust({ country: v })} disabled={ro || !selectedCustomer || !custEdit}
                    options={COUNTRIES.map(c => ({ value: c.code, label: c[lang === 'en' ? 'en' : 'sl'] }))} />
                </div>
                {/* sales channel: where the customer heard of the company */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[#7f7f7f]">{lang === 'en' ? 'Sales channel' : 'Prodajni kanal'}<span className="req-star"> *</span></label>
                  <Select value={leadSource} onChange={setLeadSource} disabled={ro} placeholder={lang === 'en' ? 'Where did they hear of us?' : 'Kje je stranka izvedela za nas?'}
                    options={leadSourceOptions(lang === 'en' ? 'en' : 'sl')} />
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 mt-7 mb-6" />
            <h2 className="text-[22px] leading-7 tracking-[-0.02em] font-semibold text-gray-900 mb-4">{lang === 'en' ? 'Commercial terms' : 'Komercialni pogoji'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-3 text-sm font-semibold text-gray-900 pt-0 flex items-center justify-between gap-3">
                <span>{lang === 'en' ? 'Address of the works' : 'Naslov montaže'}</span>
                {!ro && selectedCustomer && <label className="flex items-center gap-2 text-xs font-normal normal-case tracking-normal text-[#7f7f7f] cursor-pointer"><input type="checkbox" className="rounded border-gray-300" checked={!!siteAddress && siteAddress === custAddr} onChange={e => setSiteAddress(e.target.checked ? custAddr : '')} />{lang === 'en' ? 'Same as the customer address' : 'Enako kot naslov stranke'}</label>}
              </div>
              <div className="lg:col-span-3"><Input id="q-site" label={lang === 'en' ? 'Street and house number' : 'Ulica in hišna številka'} value={site.street} onChange={e => setSite(x => ({ ...x, street: e.target.value }))} /></div>
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ro || site.country !== 'SI'
                  ? <>
                    <Input id="q-postal" label={lang === 'en' ? 'Postal code' : 'Poštna številka'} value={site.postal} onChange={e => setSite(x => ({ ...x, postal: e.target.value }))} />
                    <Input id="q-city" label={lang === 'en' ? 'Town' : 'Kraj'} value={site.city} onChange={e => setSite(x => ({ ...x, city: e.target.value }))} />
                  </>
                  : <PostFields postalLabel={lang === 'en' ? 'Postal code' : 'Poštna številka'} cityLabel={lang === 'en' ? 'Town' : 'Kraj'} code={site.postal} city={site.city}
                      onChange={(postal, city) => setSite(x => ({ ...x, postal, city }))} />}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[#7f7f7f]">{lang === 'en' ? 'Country' : 'Država'}</label>
                  <Select value={site.country} onChange={v => setSite(x => ({ ...x, country: v }))} disabled={ro}
                    options={COUNTRIES.map(c => ({ value: c.code, label: c[lang === 'en' ? 'en' : 'sl'] }))} />
                </div>
              </div>
              <div className="lg:col-span-3 text-sm font-semibold text-gray-900 pt-2">{lang === 'en' ? 'Terms' : 'Pogoji'}</div>
              <Input id="q-valid" label={s.validUntil} type={ro ? 'text' : 'date'}
                value={ro ? (validUntil ? format(new Date(validUntil), 'd. M. yyyy') : '') : validUntil}
                onChange={e => setValidUntil(e.target.value)} />
              <Input id="q-lead" label={o.executionTime} placeholder={ro ? '' : o.executionTimeHint} value={leadTime} onChange={e => setLeadTime(e.target.value)} />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[#7f7f7f]">{o.parity}</label>
                <Select value={parity} onChange={setParity}
                  options={[{ value: '', label: o.none }, ...INCOTERMS.map(i => ({ value: i.code, label: i.code, hint: i.name }))]} />
              </div>
              <div className="lg:col-span-2 flex flex-col gap-1">
                <label className="text-xs font-medium text-[#7f7f7f]">{s.paymentTerms}</label>
                {ro
                  ? <div className="rounded-lg border px-3 py-2 text-sm min-h-[38px]" style={{ backgroundColor: '#f9fafb', borderColor: '#eeeff1', color: '#5e5e5e' }}>{paymentTerms || '—'}</div>
                  : termOptions.length === 0
                    ? <button type="button" onClick={() => navigate('/settings')} className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-900 text-left hover:bg-blue-50/40">{o.addTermsInSettings}</button>
                    : <Select value={paymentTerms} onChange={setPaymentTerms}
                        options={[{ value: '', label: o.none }, ...termOptions.map(term => ({ value: term, label: term }))]} />}
              </div>
            </div>
            <div className="border-t border-gray-100 mt-7 mb-6" />
            <h2 className="text-[22px] leading-7 tracking-[-0.02em] font-semibold text-gray-900 mb-4">{lang === 'en' ? 'Notes and attachments' : 'Opombe in priloge'}</h2>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#7f7f7f]">{s.notes}</label>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder={ro ? '' : o.notesHint}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50 disabled:text-[#5e5e5e] disabled:border-[#eeeff1]" />
            </div>
          </fieldset>

          {/* Attachments — plain list: open / download / delete (delete only while draft) */}
          <div className="mt-5">
            <p className="text-xs font-medium text-[#7f7f7f] flex items-center gap-1.5 mb-2"><Paperclip className="w-3.5 h-3.5" />{o.attachments}</p>
            {attachments.map(att => (
              <div key={att.id} className="flex items-center gap-2 px-3 py-2 bg-[#eff5fe] border border-[#deeafd] rounded-lg mb-2">
                <FileText className="w-4 h-4 text-gray-900 shrink-0" />
                <button type="button" onClick={() => openFile(att)} className="text-sm text-gray-900 hover:underline font-medium flex-1 text-left truncate">{att.file_name}</button>
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

        {/* ── Windows (configurator) ───────────────────── */}
        {(cfg || windowLines.length > 0) && <div className={`bg-white rounded-xl border mb-5 ${border}`}>
          <div className={`flex items-center justify-between gap-2 px-6 py-3.5 border-b ${ro ? 'border-[#eeeff1]' : 'border-gray-100'}`}>
            <h2 className="text-base font-semibold tracking-[-0.01em] text-gray-900">{o.windowsTitle}</h2>
            {!ro && cfg && <Button size="sm" onClick={() => setCfgOpen({})} className="gap-1.5"><Plus className="w-3.5 h-3.5" />{o.addWindow}</Button>}
          </div>
          {windowLines.length === 0
            ? <p className="px-6 py-8 text-center text-sm text-[#5e5e5e]">{o.noWindows}</p>
            : <div className="divide-y divide-gray-100">
              {windowLines.map((l, i) => {
                const w = windowCfg(l)!
                const it = w.item
                return <div key={l.key} className="px-6 py-5 grid grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)] gap-6">
                  {/* drawing with the sizes */}
                  <div className={`flex items-start justify-center ${!ro && cfg ? 'cursor-pointer' : ''}`} onClick={() => { if (!ro && cfg) setCfgOpen({ key: l.key, items: [it] }) }} title={!ro && cfg ? o.editWindow : undefined}>
                    {it.roof ? <RoofWindowDrawing size={130} />
                      : it.spec ? <SpecDrawing spec={it.spec} width={it.width ?? 0} height={it.height ?? 0} size={160} showDims />
                      : w.template ? <WindowDrawing template={w.template as never} width={it.width ?? 0} height={it.height ?? 0} hinge={it.hinge} size={160} showDims /> : null}
                  </div>
                  {/* every choice */}
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#7f7f7f]">{o.position} {i + 1}</div>
                        <div className="text-base leading-6 font-semibold text-gray-900">{w.title}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {!ro && <div className="flex items-center gap-1">
                          <Button variant="secondary" size="sm" className="gap-1.5" disabled={!cfg} onClick={() => setCfgOpen({ key: l.key, items: [it] })}><Pencil className="w-3.5 h-3.5" />{o.editWindow}</Button>
                          <button type="button" onClick={() => removeLine(l.key)} title={t.common.delete} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>}
                        <div className="text-right">
                          <div className="text-xs text-[#7f7f7f]">{(l.quantity ?? 0).toLocaleString('de-DE')} × {money(l.unit_price ?? 0)}</div>
                          <div className="text-base leading-6 font-semibold text-gray-900 tabular-nums">{money(lineTotal(num(l)))}</div>
                        </div>
                      </div>
                    </div>
                    <dl className="mt-2 grid grid-cols-[minmax(110px,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                      {w.rows.map(([k, v]) => <div key={k} className="contents"><dt className="font-medium text-[#5e5e5e]">{k}</dt><dd className="font-medium text-gray-900">{v}</dd></div>)}
                    </dl>
                    {subsOf(l).length > 0 && <div className="mt-3 rounded-[10px] border border-gray-200 divide-y divide-gray-100">
                      {subsOf(l).map(sl => {
                        const sc = subCfg(sl)!
                        return <div key={sl.key} className="px-3 py-2.5 grid grid-cols-[44px_52px_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                          <span className="font-medium text-[#5e5e5e]">{i + 1}-{sc.code}</span>
                          <div className="w-[52px] h-[52px] rounded-lg bg-[#fbfbfb] border border-gray-100 flex items-center justify-center overflow-hidden">
                            {sc.image_url ? <img src={sc.image_url} alt="" className="max-w-full max-h-full object-contain" />
                              : sc.sill != null || !sc.shade ? <SillIcon material={sc.sill} size={44} /> : <ShadingIcon kind={sc.shade} size={44} />}
                          </div>
                          <div className="min-w-0"><div className="font-medium text-gray-900">{sc.title}</div><div className="text-xs text-[#7f7f7f]">{sc.rows.map(([k, v]) => `${k}: ${v}`).join(' · ')}</div></div>
                          <div className="text-right whitespace-nowrap"><span className="font-medium text-[#5e5e5e] mr-3">{(sl.quantity ?? 0).toLocaleString('de-DE')} × {money(sl.unit_price ?? 0)}</span><span className="font-semibold text-gray-900">{money(lineTotal(num(sl)))}</span></div>
                        </div>
                      })}
                    </div>}
                    {calcs[l.key] && <details open className="mt-3 group">
                      <summary className="cursor-pointer select-none text-xs font-medium text-[#7f7f7f] hover:text-gray-900 mb-2 list-none flex items-center gap-1.5"><ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />{sl ? 'Kalkulacija pozicije' : 'Position calculation'}</summary>
                      <WindowCalcTable calc={calcs[l.key]!} lang={sl ? 'sl' : 'en'} saved={l.unit_price != null ? l.unit_price + subsOf(l).reduce((a, x) => a + (x.unit_price ?? 0), 0) : null} />
                    </details>}
                  </div>
                </div>
              })}
            </div>}
        </div>}

        {/* ── Services, computed from the windows ─────── */}
        {(cfg && svcOptions.length > 0 && !ro) || serviceLines.length > 0 ? <div className={`bg-white rounded-xl border mb-5 ${border}`}>
          <div className={`px-6 py-3.5 border-b ${ro ? 'border-[#eeeff1]' : 'border-gray-100'}`}>
            <h2 className="text-base font-semibold tracking-[-0.01em] text-gray-900">{o.servicesTitle}</h2>
            {!ro && <p className="text-xs text-[#7f7f7f] mt-0.5">{o.servicesHint}</p>}
          </div>
          {!ro && cfg && <div className="px-6 py-4 space-y-4 border-b border-gray-100">
            {([...SERVICE_GROUPS, 'roof'] as const).map(g => {
              const opts = g === 'roof' ? svcOptions.filter(x => x.per_item === 'roof') : svcOptions.filter(x => x.group_key === g && (!x.per_item || x.per_item === 'window'))
              if (!opts.length || (g === 'roof' && !windowLines.some(l => windowCfg(l)!.item.roof))) return null
              return <div key={g}>
                <div className="text-sm font-semibold text-gray-900 mb-2">{g === 'roof' ? o.roofWindows : WL[lang === 'en' ? 'en' : 'sl'].groups[g]}</div>
                <div className="flex flex-wrap gap-2">
                  {opts.map(x => {
                    const on = chosenServices.includes(x.id)
                    return <button key={x.id} type="button" onClick={() => toggleService(x)}
                      className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] border text-sm font-medium transition-colors ${on ? 'border-blue-600 bg-white text-gray-900 shadow-[inset_0_0_0_1px_#266df0]' : 'border-gray-200 bg-white text-gray-900 hover:border-gray-400'}`}>
                      {on && <Check className="w-3.5 h-3.5" />}{x.name}{svcAmount(x) > 0 && <span className="font-normal text-[#5e5e5e]">{money(svcAmount(x))}</span>}
                    </button>
                  })}
                </div>
              </div>
            })}
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => { addLine(''); setTimeout(() => document.getElementById('general-lines')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }}><Plus className="w-3.5 h-3.5" />{lang === 'en' ? 'Add another service' : 'Dodaj drugo storitev'}</Button>
          </div>}
          {serviceLines.length > 0 && <div className="divide-y divide-gray-100">
            {serviceLines.map((l, i) => (
              <div key={l.key} className="px-6 py-3 grid grid-cols-[48px_minmax(0,1fr)_auto] items-baseline gap-4 text-sm">
                <span className="font-medium text-[#5e5e5e]">M{i + 1}</span>
                <div className="min-w-0"><div className="font-medium text-gray-900">{l.name}</div>{l.description && <div className="text-xs text-[#7f7f7f]">{l.description}</div>}</div>
                <div className="text-right whitespace-nowrap">
                  <span className="font-medium text-[#5e5e5e] mr-4">{(l.quantity ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 2 })} {o.units[l.unit]} × {money(l.unit_price ?? 0)}</span>
                  <span className="font-semibold text-gray-900">{money(lineTotal(num(l)))}</span>
                </div>
              </div>
            ))}
          </div>}
        </div> : null}

        {/* ── Lines ─────────────────────────────────────── */}
        <div id="general-lines" className={`bg-white rounded-xl border overflow-hidden mb-5 ${border}`}>
          <div className={`flex items-center justify-between gap-2 px-6 py-3 border-b ${ro ? 'border-[#eeeff1]' : 'border-gray-100'}`}>
            <h2 className="text-base font-semibold text-gray-900">{o.lines}</h2>
            {!ro && <Button variant="secondary" size="sm" onClick={() => addLine('')} className="gap-1.5"><Plus className="w-3.5 h-3.5" />{lang === 'en' ? 'Add item' : 'Dodaj postavko'}</Button>}
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
                const rl = freeLines.filter(l => l.room === rn)
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
                          <Select size="sm" value={l.unit} disabled={ro} onChange={v => patchLine(l.key, { unit: v as PriceUnit })} className={ro ? 'border-transparent bg-transparent disabled:bg-transparent' : ''}
                            options={PRICE_UNITS.map(u => ({ value: u, label: o.units[u] }))} />
                        </td>
                        <td className="px-2 py-2.5"><NumCell value={l.unit_price} disabled={ro} onValue={v => patchLine(l.key, { unit_price: v })} /></td>
                        <td className="px-2 py-2.5"><NumCell value={l.discount_pct} decimals={0} disabled={ro} onValue={v => patchLine(l.key, { discount_pct: v })} /></td>
                        <td className="px-2 py-2.5">
                          <Select size="sm" align="right" value={l.vat_rate} disabled={ro} onChange={v => patchLine(l.key, { vat_rate: Number(v) })} className={ro ? 'border-transparent bg-transparent disabled:bg-transparent' : ''}
                            options={VAT_RATES.map(v => ({ value: v, label: `${v.toLocaleString('de-DE')}%` }))} />
                        </td>
                        <td className="px-4 py-2.5 pt-4 text-right font-medium text-gray-800 whitespace-nowrap">{money(lineTotal(num(l)))}</td>
                        {!ro && <td className="px-2 py-2.5 pt-3.5">
                          <button type="button" onClick={() => removeLine(l.key)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>}
                      </tr>
                    ) })}
                    {!ro && grouped && (
                      <tr><td colSpan={colCount} className="px-4 py-1.5 text-right">
                        <button type="button" onClick={() => addLine(rn)} className="inline-flex items-center gap-1 text-xs text-gray-900 hover:text-black font-medium"><Plus className="w-3.5 h-3.5" />{o.addLine}</button>
                      </td></tr>
                    )}
                  </tbody>
                )
              }) })()}
              {!ro && !grouped && (
                <tbody><tr>
                  <td colSpan={colCount} className="px-4 py-2 border-t border-gray-100 text-right">
                    <button type="button" onClick={() => addLine()} className="inline-flex items-center gap-1.5 text-sm text-gray-900 hover:text-black font-medium"><Plus className="w-4 h-4" />{o.addLine}</button>
                  </td>
                </tr></tbody>
              )}
              {ro && freeLines.length === 0 && (
                <tbody><tr><td colSpan={colCount} className="px-4 py-8 text-center text-sm text-gray-400">{o.noLines}</td></tr></tbody>
              )}

              {/* Totals */}
              <tfoot className={`hidden sm:table-footer-group border-t ${border} bg-gray-50`}>
                <tr>
                  <td colSpan={colCount - (ro ? 1 : 2)} className="px-4 pt-3 pb-1 text-right text-sm text-gray-500">{o.subtotal}</td>
                  <td className="px-4 pt-3 pb-1 text-right text-sm text-gray-700 whitespace-nowrap">{money(totals.subtotal)}</td>
                  {!ro && <td />}
                </tr>
                {/* read-only: no discount → no row (nothing to show) */}
                {(!ro || totals.discount_amount > 0) && <tr>
                  <td colSpan={colCount - (ro ? 1 : 2)} className="px-4 py-1.5 text-right text-sm text-gray-500">{o.quoteDiscount}</td>
                  <td className="px-4 py-1.5 text-right">
                    {ro ? <span className="text-sm text-gray-700">{totals.discount_amount > 0 ? `${(discountPct ?? 0).toLocaleString('de-DE')}% (−${money(totals.discount_amount)})` : ''}</span>
                      : <div className="w-28 ml-auto"><NumberInput unit="%" value={discountPct} onValue={setDiscountPct} /></div>}
                  </td>
                  {!ro && <td />}
                </tr>}
                <tr>
                  <td colSpan={colCount - (ro ? 1 : 2)} className="px-4 py-1.5 text-right text-sm font-medium text-gray-700">{o.totalNet}</td>
                  <td className="px-4 py-1.5 text-right text-sm font-medium text-gray-900 whitespace-nowrap">{money(totals.total_net)}</td>
                  {!ro && <td />}
                </tr>
                {/* VAT rate: automatic by the rule (22 %, or 9,5 % for installation at a private person), or set by hand for the odd case */}
                {!ro && <tr>
                  <td colSpan={colCount - 2} className="px-4 py-1 text-right text-sm text-gray-500">
                    <span className="inline-flex items-center gap-2">{sl ? 'Stopnja DDV' : 'VAT rate'}
                      <span className="block w-64 text-left"><Select size="xs" value={reverseCharge ? 'reverse' : manualVat === null ? 'auto' : String(manualVat)} onChange={v => { setReverseCharge(v === 'reverse'); setVatRate(v === 'auto' ? null : v === 'reverse' ? 0 : Number(v)) }}
                        options={[
                          { value: 'auto', label: `${sl ? 'Samodejno' : 'Automatic'} (${vatTarget.toLocaleString('de-DE')} %)` },
                          ...[22, 9.5, 5, 0].filter(r => r !== vatTarget || manualVat === r).map(r => ({ value: String(r), label: `${r.toLocaleString('de-DE')} %` })),
                          { value: 'reverse', label: sl ? 'Obrnjena davčna obveznost (0 %)' : 'Reverse charge (0 %)' },
                        ]} /></span>
                    </span>
                  </td>
                  <td colSpan={2} />
                </tr>}
                {totals.vat.map(v => (
                  <tr key={v.rate}>
                    <td colSpan={colCount - (ro ? 1 : 2)} className="px-4 py-1 text-right text-sm text-gray-500">{o.vat} {v.rate.toLocaleString('de-DE')}% ({money(v.base)})</td>
                    <td className="px-4 py-1 text-right text-sm text-gray-700 whitespace-nowrap">{money(v.amount)}</td>
                    {!ro && <td />}
                  </tr>
                ))}
                <tr className={`border-t-2 ${border}`}>
                  <td colSpan={colCount - (ro ? 1 : 2)} className="px-4 py-3 text-right text-sm font-bold text-gray-900">{o.totalGross}</td>
                  <td className="px-4 py-3 text-right text-base font-bold text-gray-900 whitespace-nowrap">{money(totals.total_gross)}</td>
                  {!ro && <td />}
                </tr>
                {(!ro || advanceGross != null) && <tr>
                  <td colSpan={colCount - (ro ? 1 : 2)} className="px-4 pt-1 pb-1.5 text-right text-sm text-gray-500">{lang === 'en' ? 'Discount for 100% advance payment' : 'Popust ob plačilu 100% avansa'}</td>
                  <td className="px-4 pt-1 pb-1.5 text-right">
                    {ro ? <span className="text-sm text-gray-700">{(advancePct ?? 0).toLocaleString('de-DE')}%</span>
                      : <div className="w-28 ml-auto"><NumberInput unit="%" value={advancePct} onValue={setAdvancePct} /></div>}
                  </td>
                  {!ro && <td />}
                </tr>}
                {advanceGross != null && <tr>
                  <td colSpan={colCount - (ro ? 1 : 2)} className="px-4 pt-1 pb-3 text-right text-sm font-semibold text-gray-900">{lang === 'en' ? 'Total with 100% advance payment' : 'Skupaj ob plačilu 100% avansa'}</td>
                  <td className="px-4 pt-1 pb-3 text-right text-base font-semibold text-[#26897a] whitespace-nowrap">{money(advanceGross)}</td>
                  {!ro && <td />}
                </tr>}
              </tfoot>
            </table>
          </div>
          {/* phones: the totals under the lines (the table scrolls sideways, so its footer is out of sight) */}
          <div className={`sm:hidden border-t ${border} bg-gray-50 px-4 py-3 space-y-2 text-sm`}>
            <div className="flex justify-between text-gray-500"><span>{o.subtotal}</span><span className="text-gray-700">{money(totals.subtotal)}</span></div>
            {(!ro || totals.discount_amount > 0) && <div className="flex items-center justify-between gap-3 text-gray-500"><span>{o.quoteDiscount}</span>
              {ro ? <span className="text-gray-700">{`${(discountPct ?? 0).toLocaleString('de-DE')}% (−${money(totals.discount_amount)})`}</span>
                : <div className="w-28"><NumberInput unit="%" value={discountPct} onValue={setDiscountPct} /></div>}</div>}
            <div className="flex justify-between font-medium text-gray-900"><span>{o.totalNet}</span><span>{money(totals.total_net)}</span></div>
            {totals.vat.map(v => <div key={v.rate} className="flex justify-between text-gray-500"><span>{o.vat} {v.rate.toLocaleString('de-DE')}%</span><span className="text-gray-700">{money(v.amount)}</span></div>)}
            <div className={`flex justify-between border-t-2 ${border} pt-2 font-bold text-gray-900`}><span>{o.totalGross}</span><span className="text-base">{money(totals.total_gross)}</span></div>
            {(!ro || advanceGross != null) && <div className="flex items-center justify-between gap-3 text-gray-500"><span>{lang === 'en' ? 'Discount for 100% advance' : 'Popust ob 100% avansu'}</span>
              {ro ? <span className="text-gray-700">{(advancePct ?? 0).toLocaleString('de-DE')}%</span>
                : <div className="w-28"><NumberInput unit="%" value={advancePct} onValue={setAdvancePct} /></div>}</div>}
            {advanceGross != null && <div className="flex justify-between font-semibold text-gray-900"><span>{lang === 'en' ? 'Total with 100% advance' : 'Skupaj ob 100% avansu'}</span><span className="text-[#26897a]">{money(advanceGross)}</span></div>}
          </div>
        </div>
      </div>
      <aside className="mt-5 xl:mt-0 xl:sticky xl:top-6 space-y-4">
        <div className={`bg-white rounded-xl border p-5 ${border}`}>
          <div className="text-base font-semibold text-gray-900 mb-3">{sl ? 'Skupaj' : 'Total'}</div>
          {windowLines.length > 0 && <ul className="space-y-1.5 text-sm">
            {windowLines.map((l, i) => <li key={l.key} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-gray-900">{o.position} {i + 1} · {windowCfg(l)!.title}{(l.quantity ?? 0) > 1 && <span className="text-xs text-[#7f7f7f]"> {(l.quantity ?? 0)} ×</span>}</span>
              <span className="font-medium text-gray-900 whitespace-nowrap tabular-nums">{money(positionTotal(l))}</span>
            </li>)}
            <li className="flex items-baseline justify-between gap-3 pt-1.5 mt-1 border-t border-gray-100">
              <span className="font-semibold text-gray-900">{sl ? 'Okna skupaj' : 'Windows total'}</span>
              <span className="font-semibold text-gray-900 whitespace-nowrap tabular-nums">{money(windowLines.reduce((a, l) => a + positionTotal(l), 0))}</span>
            </li>
          </ul>}
          {serviceLines.length > 0 && <ul className="space-y-1 text-sm mt-3 pt-3 border-t border-gray-100">
            <li className="text-xs font-medium text-[#7f7f7f]">{o.servicesTitle}</li>
            {serviceLines.map(l => <li key={l.key} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-gray-900">{l.name} <span className="text-xs text-[#7f7f7f]">{(l.quantity ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 2 })} {o.units[l.unit]}</span></span>
              <span className="font-medium text-gray-900 whitespace-nowrap tabular-nums">{money(lineTotal(num(l)))}</span>
            </li>)}
          </ul>}
          {freeLines.some(l => lineTotal(num(l)) !== 0) && <div className="flex items-baseline justify-between gap-3 text-sm mt-3 pt-3 border-t border-gray-100">
            <span className="text-gray-900">{o.lines}</span>
            <span className="font-medium text-gray-900 whitespace-nowrap tabular-nums">{money(freeLines.reduce((a, l) => a + lineTotal(num(l)), 0))}</span>
          </div>}
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-[#5e5e5e]">{sl ? 'Skupaj postavke' : 'Subtotal'}</span><span className="tabular-nums">{money(totals.subtotal)}</span></div>
            {totals.discount_amount > 0 && <div className="flex justify-between"><span className="text-[#5e5e5e]">{sl ? `Popust ${discountPct ?? 0} %` : `Discount ${discountPct ?? 0}%`}</span><span className="tabular-nums">− {money(totals.discount_amount)}</span></div>}
            <div className="flex justify-between font-medium text-gray-900"><span>{sl ? 'Skupaj brez DDV' : 'Total excl. VAT'}</span><span className="tabular-nums">{money(totals.total_net)}</span></div>
            {totals.vat.map(v => <div key={v.rate} className="flex justify-between text-[#5e5e5e]"><span>DDV {v.rate.toLocaleString('de-DE')} %</span><span className="tabular-nums">{money(v.amount)}</span></div>)}
            <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-gray-200">
              <span className="text-sm font-semibold text-gray-900">{sl ? 'Skupaj z DDV' : 'Total incl. VAT'}</span>
              <span className="text-[26px] leading-8 font-bold tracking-[-0.02em] text-gray-900 tabular-nums">{money(totals.total_gross)}</span>
            </div>
            {advanceGross != null && <div className="flex justify-between text-[#5e5e5e]"><span>{sl ? `Popust ob 100 % avansu (${(advancePct ?? 0).toLocaleString('de-DE')} %)` : `Discount for 100% advance (${(advancePct ?? 0).toLocaleString('de-DE')}%)`}</span><span className="tabular-nums">− {money(totals.total_gross - advanceGross)}</span></div>}
            {advanceGross != null && <div className="flex justify-between text-[#267a47] font-medium"><span>{sl ? 'Skupaj ob 100% avansu' : 'Total with 100% advance'}</span><span className="tabular-nums">{money(advanceGross)}</span></div>}
          </div>
        </div>
        {(() => {
          // what the windows of this quote cost and what is left: the supplier's own view, never on the offer
          const rows = windowLines.map(l => ({ l, c: calcs[l.key] })).filter(x => x.c && x.c.kind === 'window') as { l: LineRow; c: NonNullable<typeof calcs[string]> }[]
          if (!rows.length) return null
          const cost = rows.reduce((a, x) => a + x.c.cost * (x.l.quantity ?? 0), 0)
          const sale = rows.reduce((a, x) => a + positionTotal(x.l), 0)
          const margin = sale - cost
          return <div className={`bg-white rounded-xl border p-5 ${border}`}>
            <div className="text-base font-semibold text-gray-900">{sl ? 'Kalkulacija oken' : 'Windows calculation'}</div>
            <p className="text-xs text-[#7f7f7f] mt-0.5 mb-3">{sl ? 'Interno: nabavna vrednost, marža in prodajna cena vseh oken. Ni na ponudbi.' : 'Internal: purchase value, margin and sale price of all windows. Not on the offer.'}</p>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1.5 text-sm tabular-nums">
              <dt className="text-[#5e5e5e]">{sl ? 'Nabavna vrednost' : 'Purchase value'}</dt><dd className="text-right text-gray-900">{money(cost)}</dd>
              <dt className="text-[#5e5e5e]">{sl ? 'Marža' : 'Margin'}</dt><dd className="text-right text-[#267a47]">{money(margin)}{sale > 0 && <span className="text-[#5e5e5e]"> ({(Math.round(margin / sale * 1000) / 10).toLocaleString('de-DE')} %)</span>}</dd>
              <dt className="font-semibold text-gray-900">{sl ? 'Prodajna vrednost oken' : 'Sale value of windows'}</dt><dd className="text-right font-semibold text-gray-900">{money(sale)}</dd>
            </dl>
          </div>
        })()}
      </aside></div>) : (
        snapshot?.lines ? (
          <OfferPdfPreview snap={pdfSnap ?? snapshot} lang={lang} errorLabel={o.pdfError} />
        ) : <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">{s.saveQuoteFirst}</div>
      )}

      {/* Window configurator over the whole page */}
      {cfgOpen && cfg && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
            <div className="w-full px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
              <h2 className="text-[19px] font-bold tracking-[-0.015em] text-gray-900">{cfgOpen.key ? (lang === 'en' ? 'Editing the window' : 'Urejanje okna') : (lang === 'en' ? 'New window' : 'Novo okno')}</h2>
              <button type="button" onClick={() => setCfgOpen(null)} className="h-9 px-4 rounded-[10px] border border-gray-200 bg-white text-sm font-semibold text-gray-900 hover:border-gray-400 transition-colors shrink-0">{lang === 'en' ? 'Back to the quote' : 'Nazaj na ponudbo'}</button>
            </div>
          </div>
          <ConfiguratorCore data={cfg} mode="internal" initialItems={cfgOpen.items} onCancel={() => setCfgOpen(null)}
            addLabel={cfgOpen.key ? o.saveWindow : undefined} onAdd={ws => addWindows(ws, cfgOpen.key)} />
        </div>
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
            <div key={lbl} className="rounded-[10px] bg-[#fbfbfb] border border-gray-200 px-3 py-2.5">
              <div className="text-xs font-medium text-[#7f7f7f]">{lbl}</div>
              <div className="text-base font-semibold text-gray-900">{v.toLocaleString('de-DE', { maximumFractionDigits: 2 })} {u}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {([['wallItem', o.wallsWork], ['ceilingItem', o.ceilingWork]] as const).map(([k, lbl]) => (
            <div key={k} className="flex flex-col gap-1">
              <label className="field-label text-xs font-medium text-[#7f7f7f]">{lbl}</label>
              <Select value={room[k]} onChange={v => setRoom(r => ({ ...r, [k]: v }))}
                options={[{ value: '', label: o.none }, ...m2Items.map(p => ({ value: p.id, label: p.name, hint: money(Number(p.price)) }))]} />
            </div>
          ))}
        </div>
        {m2Items.length === 0 && <p className="text-xs text-gray-500 mt-2">{o.roomNoPriceItems}</p>}
        <div className="flex justify-end gap-3 mt-5 pt-4 -mx-6 px-6 border-t border-gray-200">
          <Button variant="secondary" onClick={() => setRoomOpen(false)}>{t.common.cancel}</Button>
          <Button onClick={addRoom} disabled={!room.length || !room.width}>{o.addRoomLines}</Button>
        </div>
      </Modal>

      <ConfirmDialog open={deleteQuoteOpen} onClose={() => setDeleteQuoteOpen(false)}
        onConfirm={() => { setDeleteQuoteOpen(false); deleteQuote() }}
        title={s.quotes} message={s.deleteQuoteConfirm} confirmLabel={t.common.delete} danger />

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => { const c = confirm; setConfirm(null); if (c === 'issue') issue(); else if (c) changeStatus(c === 'back' ? backStatus : c) }}
title={confirm === 'issue' ? s.issueOffer : confirm === 'back' ? (backStatus === 'sent' ? (sl ? 'Vrni v Poslano' : 'Back to Sent') : (sl ? 'Vrni v Preneseno' : 'Back to Downloaded')) : confirm === 'measure' ? (sl ? 'Premakni v izmero' : 'Move to measurement') : confirm === 'sent' ? s.markSentLabel : confirm === 'lost' ? s.markRejected : s.markAccepted}        message={confirm === 'issue' ? (sl ? 'Ali želite izdati to ponudbo?' : 'Do you want to issue this offer?') : confirm === 'back' ? (sl ? 'Ali želite vrniti prejšnji status ponudbe?' : 'Return the offer to its previous status?') : confirm === 'measure' ? (sl ? 'Ali želite ponudbo premakniti v izmero?' : 'Move this offer to measurement?') : confirm === 'sent' ? (sl ? 'Ali ste ponudbo poslali stranki?' : 'Have you sent the offer to the customer?') : confirm === 'lost' ? s.confirmLost : s.confirmWon}        confirmLabel={confirm === 'issue' ? s.issueOffer : confirm === 'back' ? (backStatus === 'sent' ? (sl ? 'Vrni v Poslano' : 'Back to Sent') : (sl ? 'Vrni v Preneseno' : 'Back to Downloaded')) : confirm === 'measure' ? (sl ? 'Premakni v izmero' : 'Move to measurement') : confirm === 'sent' ? s.markSentLabel : confirm === 'lost' ? s.markRejected : s.markAccepted} danger={confirm === 'lost'} />
    </div>
  )
}
