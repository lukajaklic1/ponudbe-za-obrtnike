import { useEffect, useRef, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Plus, FileText, Search, Check, X, ChevronDown, MoreVertical, List, Columns3 } from 'lucide-react'
import QuotesKanban from '../components/QuotesKanban'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { toast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import Button from '../components/ui/Button'
import Pagination from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { SortIcon } from '../components/ui/SortIcon'
import { FilterSelect } from '../components/ui/FilterSelect'
import { DateFilter } from '../components/ui/DateFilter'
import { PersonBadge } from '../components/ui/PersonBadge'
import type { Quote, QuoteStatus } from '../types/database'
import { format } from 'date-fns'

interface CompanyUser { id: string; first_name: string; last_name: string }


const PAGE_SIZE = 20
const STATUSES: QuoteStatus[] = ['draft', 'issued', 'sent', 'won', 'lost']

const STATUS_STYLE: Record<QuoteStatus, { bg: string; border: string; color: string }> = {
  draft:    { bg: '#fff3cc', border: '#ffe5a0', color: '#874d00' },
  issued:   { bg: '#f3edff', border: '#e6dbff', color: '#6b3fc9' },
  sent:     { bg: '#e5eeff', border: '#d6e5ff', color: '#215bcf' },
  accepted: { bg: '#e0fced', border: '#d4f8e6', color: '#098259' },
  rejected: { bg: '#feeee1', border: '#fee0c8', color: '#9e3f00' },
  expired:  { bg: '#fff3cc', border: '#ffe5a0', color: '#874d00' },
  won:      { bg: '#e0fced', border: '#d4f8e6', color: '#098259' },
  lost:     { bg: '#feeee1', border: '#fee0c8', color: '#9e3f00' },
  frozen:   { bg: '#e5eeff', border: '#d6e5ff', color: '#215bcf' },
}

const VIEW_KEY = 'obrtdesk-quotes-view'

interface Row extends Quote { customers: { name: string } | null; assignee: { first_name: string; last_name: string } | null }

export default function QuotesPage() {
  const { company, hasPerm, loading: permLoading } = useCompany()
  const canEdit = hasPerm('quotes', 'create')
  const { t, lang } = useLanguage()
  const s = t.qp
  const navigate = useNavigate()
  const sl = lang === 'sl'
  // Days an open quote has been in its current status (null = final status: won / lost)
  const waitingDays = (q: Quote) => {
    const from = q.status === 'draft' ? q.created_at
      : q.status === 'issued' ? (q.issued_at ?? q.updated_at)
      : q.status === 'sent' ? (q.sent_at ?? q.issued_at ?? q.updated_at)
      : null
    if (!from) return null
    return Math.max(0, Math.floor((Date.now() - Date.parse(from)) / 86400000))
  }
  const daysLabel = (d: number) => sl
    ? `${d} ${d === 1 ? 'dan' : d === 2 ? 'dneva' : d === 3 || d === 4 ? 'dnevi' : 'dni'}`
    : `${d} ${d === 1 ? 'day' : 'days'}`
  const [rows, setRows] = useState<Row[]>([])
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')   // created_at range, yyyy-mm-dd
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<'quote_number' | 'customer' | 'status' | 'waiting' | 'value' | 'created_at'>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  function handleSort(k: typeof sortKey) { setSortKey(k); setSortDir(d => k === sortKey ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); setPage(1) }
  const [view, setView] = useState<'list' | 'kanban'>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'kanban' ? 'kanban' : 'list' } catch { return 'list' }
  })
  function changeView(v: 'list' | 'kanban') { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* private mode */ } }
  const [pendingMove, setPendingMove] = useState<{ quote: Row; to: QuoteStatus } | null>(null)

  useEffect(() => { if (company) { load(); loadUsers() } }, [company])
  useEffect(() => {
    if (!openMenu) return
    const close = () => setOpenMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [openMenu])

  async function loadUsers() {
    const { data } = await supabase.from('users').select('id, first_name, last_name').eq('company_id', company!.id).eq('is_active', true).order('first_name')
    if (data) setCompanyUsers(data as CompanyUser[])
  }

  async function load() {
    if (!company) return
    // spinner only on first load (initial state) — reloads keep the current view on screen
    const { data: q } = await supabase.from('quotes').select('*, customers(name), assignee:users!assignee_id(first_name, last_name)').eq('company_id', company.id).order('created_at', { ascending: false })
    setRows((q as Row[]) ?? [])
    setLoading(false)
  }

  const customerOptions = Array.from(new Map(rows.filter(r => r.customer_id).map(r => [r.customer_id, r.customers?.name ?? '—'])).entries())
    .sort((a, b) => a[1].localeCompare(b[1]))

  const filtered = rows.filter(r => {
    const assigneeName = r.assignee ? `${r.assignee.first_name} ${r.assignee.last_name}`.toLowerCase() : ''
    const q = search.toLowerCase()
    return (
      (statusFilter === 'all' || r.status === statusFilter) &&
      (customerFilter === 'all' || r.customer_id === customerFilter) &&
      (!dateFrom || format(new Date(r.created_at), 'yyyy-MM-dd') >= dateFrom) &&
      (!dateTo || format(new Date(r.created_at), 'yyyy-MM-dd') <= dateTo) &&
      (assigneeFilter === 'all' || (assigneeFilter === 'unassigned' ? !r.assignee_id : r.assignee_id === assigneeFilter)) &&
      (!search || r.quote_number.toLowerCase().includes(q) ||
        (r.customers?.name ?? '').toLowerCase().includes(q) ||
        (r.contact_person ?? '').toLowerCase().includes(q) ||
        (r.site_address ?? '').toLowerCase().includes(q) ||
        (r.title ?? '').toLowerCase().includes(q) ||
        assigneeName.includes(q))
    )
  })

  const sortedFiltered = [...filtered].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'quote_number') return a.quote_number.localeCompare(b.quote_number) * mul
    if (sortKey === 'customer') return (a.customers?.name ?? '').localeCompare(b.customers?.name ?? '') * mul
    if (sortKey === 'status') return a.status.localeCompare(b.status) * mul
    if (sortKey === 'waiting') {
      // quotes that aren't waiting always go last, whatever the direction
      const wa = waitingDays(a), wb = waitingDays(b)
      if (wa == null || wb == null) return wa == null ? (wb == null ? 0 : 1) : -1
      return (wa - wb) * mul
    }
    if (sortKey === 'value') return ((Number(a.total_net) || 0) - (Number(b.total_net) || 0)) * mul
    if (sortKey === 'created_at') return a.created_at.localeCompare(b.created_at) * mul
    return 0
  })
  const paged = sortedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const money = (n: number) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: company?.currency ?? 'EUR' })
  const openQuote = (q: Quote) => navigate(canEdit && q.status === 'draft' ? `/quotes/${q.id}/edit` : `/quotes/${q.id}`)

  const waitingBadge = (q: Quote) => {
    const d = waitingDays(q)
    if (d == null) return null
    const style = d >= 14 ? { backgroundColor: '#feeee1', border: '1px solid #fee0c8', color: '#9e3f00' }
      : d >= 7 ? { backgroundColor: '#fff3cc', border: '1px solid #ffe5a0', color: '#874d00' }
      : { backgroundColor: '#f5f5f5', border: '1px solid #e5e7eb', color: '#6b7280' }
    return <span className="px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap" style={style}>{daysLabel(d)}</span>
  }

  // Dropped on another column. Won / lost lock the offer, so ask first (same as the buttons on the offer).
  function requestMove(q: Row, to: QuoteStatus) {
    if (to === 'won' || to === 'lost') setPendingMove({ quote: q, to })
    else moveQuote(q, to)
  }

  async function moveQuote(q: Row, to: QuoteStatus) {
    const now = new Date().toISOString()
    const patch: Partial<Quote> = { status: to, updated_at: now }
    if (to === 'sent') patch.sent_at = now
    setRows(prev => prev.map(r => r.id === q.id ? { ...r, ...patch } : r))   // optimistic
    const { error } = await supabase.from('quotes').update(patch).eq('id', q.id)
    if (error) { toast.error(error.message); setRows(prev => prev.map(r => r.id === q.id ? q : r)); return }
    toast.success(t.common.saved)
  }

  if (!permLoading && !hasPerm('quotes', 'view')) return <Navigate to="/dashboard" replace />

  return (
    <div>
      <PageHeader title={s.quotes} icon={FileText} count={rows.length} action={canEdit && <Button onClick={() => navigate('/quotes/new')} className="gap-2"><Plus className="w-4 h-4" />{s.newQuote}</Button>} />
      <div className="p-4">

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-900 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t.common.search}
            className="pl-9 pr-3 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
        </div>
        <CustomerCombo options={customerOptions} value={customerFilter} onChange={v => { setCustomerFilter(v); setPage(1) }}
          allLabel={`${s.customer}: ${t.common.all}`} placeholder={s.customer} />
        <FilterSelect label={t.common.status} value={statusFilter === 'all' ? '' : statusFilter} allLabel={t.common.all}
          options={STATUSES.map(st => ({ value: st, label: s.status[st] }))}
          onChange={v => { setStatusFilter((v || 'all') as QuoteStatus | 'all'); setPage(1) }} />
        <FilterSelect label={s.assignee} value={assigneeFilter === 'all' ? '' : assigneeFilter} allLabel={t.common.all}
          options={[{ value: 'unassigned', label: s.noAssignee }, ...companyUsers.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))]}
          onChange={v => { setAssigneeFilter(v || 'all'); setPage(1) }} />
        <DateFilter label={sl ? 'Ustvarjeno od' : 'Created from'} value={dateFrom} allLabel={t.common.all} max={dateTo || undefined} onChange={v => { setDateFrom(v); setPage(1) }} />
        <DateFilter label={sl ? 'Ustvarjeno do' : 'Created to'} value={dateTo} allLabel={t.common.all} min={dateFrom || undefined} onChange={v => { setDateTo(v); setPage(1) }} />
        <div className="ml-auto inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {([['list', List, sl ? 'Seznam' : 'List'], ['kanban', Columns3, 'Kanban']] as const).map(([v, Icon, label]) => (
            <button key={v} type="button" title={label} aria-label={label} onClick={() => changeView(v)}
              className={`p-1 rounded-md transition-colors ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}>
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {view === 'kanban' && !loading ? (
        <QuotesKanban
          statuses={STATUSES.filter(st => statusFilter === 'all' || st === statusFilter)}
          quotes={sortedFiltered} canEdit={canEdit} statusLabels={s.status} money={money} waitingDays={waitingDays}
          labels={{
            empty: sl ? 'Ni ponudb' : 'No quotes', total: sl ? 'Skupaj brez DDV' : 'Total excl. VAT',
            created: t.common.created, validUntil: sl ? 'Velja do' : 'Valid until', value: t.od.totalNet,
            assignee: s.assignee, noAssignee: s.noAssignee, customer: s.customer, site: t.od.siteAddress, inStatus: sl ? 'Dni v trenutnem statusu' : 'Days in current status',
          }}
          onOpen={openQuote} onMove={requestMove} />
      ) : (<>
      <div className="-mx-4 border-t border-b border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <FileText className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">{s.noQuotes}</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[920px]">
            <thead className="bg-gray-50 border-b border-gray-200"><tr>
              {([['quote_number', s.quoteNumber], ['', t.od.quoteTitle], ['customer', s.customer], ['', s.contactPerson], ['', t.od.siteAddress], ['status', t.common.status], ['waiting', sl ? 'Čaka' : 'Waiting'], ['value', t.od.totalNet], ['created_at', t.common.created], ['', s.assignee], ['', '']] as [string, string][]).map(([key, h], i) => (
                <th key={i} className={`text-left px-4 py-3 text-xs font-medium text-gray-500 ${key ? 'cursor-pointer select-none hover:text-gray-700' : ''}`}
                  onClick={() => key && handleSort(key as typeof sortKey)}>
                  <span className="inline-flex items-center gap-0.5">{h}{key && <SortIcon active={sortKey === key} dir={sortDir} />}</span>
                </th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {paged.map(q => (
                <tr key={q.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(canEdit && q.status === 'draft' ? `/quotes/${q.id}/edit` : `/quotes/${q.id}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#e5eeff', border: '1px solid #d6e5ff' }}>
                        <FileText className="w-3.5 h-3.5" style={{ color: '#215bcf' }} />
                      </div>
                      <span className="text-gray-700">{q.quote_number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900 max-w-[260px] truncate" title={q.title && q.title !== q.customers?.name ? q.title : undefined}>{q.title && q.title !== q.customers?.name ? q.title : <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-gray-900">{q.customers?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{q.contact_person || '—'}</div>
                    {q.contact_email && <div className="text-xs text-gray-400">{q.contact_email}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[220px] truncate">{q.site_address || '—'}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: STATUS_STYLE[q.status].bg, border: `1px solid ${STATUS_STYLE[q.status].border}`, color: STATUS_STYLE[q.status].color }}>{s.status[q.status]}</span></td>
                  <td className="px-4 py-3">{waitingBadge(q) ?? <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-gray-700">{(Number(q.total_net) || 0).toLocaleString('de-DE', { style: 'currency', currency: company?.currency ?? 'EUR' })}</td>
                  <td className="px-4 py-3 text-gray-500">{format(new Date(q.created_at), 'd. M. yyyy')}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <AssigneeCell
                      quoteId={q.id}
                      assigneeId={q.assignee_id}
                      assignee={q.assignee}
                      users={companyUsers}
                      canEdit={canEdit}
                      noAssigneeLabel={s.noAssignee}
                      onChange={(uid) => setRows(prev => prev.map(r => r.id === q.id ? { ...r, assignee_id: uid, assignee: companyUsers.find(u => u.id === uid) ?? null } : r))}
                    />
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <button onClick={() => navigate(canEdit && q.status === 'draft' ? `/quotes/${q.id}/edit` : `/quotes/${q.id}`)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </>)}

      <ConfirmDialog open={!!pendingMove} onClose={() => setPendingMove(null)}
        onConfirm={() => { if (pendingMove) moveQuote(pendingMove.quote, pendingMove.to); setPendingMove(null) }}
        title={pendingMove?.to === 'lost' ? s.markRejected : s.markAccepted}
        message={`${pendingMove?.quote.quote_number ?? ''}: ${pendingMove?.to === 'lost' ? s.confirmLost : s.confirmWon}`}
        confirmLabel={pendingMove?.to === 'lost' ? s.markRejected : s.markAccepted} danger={pendingMove?.to === 'lost'} />
    </div>
    </div>
  )
}

function AssigneeCell({ quoteId, assigneeId, assignee, users, canEdit, noAssigneeLabel, onChange }: {
  quoteId: string
  assigneeId: string | null
  assignee: { first_name: string; last_name: string } | null
  users: CompanyUser[]
  canEdit: boolean
  noAssigneeLabel: string
  onChange: (uid: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function pick(uid: string | null) {
    setOpen(false)
    if (uid === assigneeId) return
    setSaving(true)
    await supabase.from('quotes').update({ assignee_id: uid }).eq('id', quoteId)
    onChange(uid)
    setSaving(false)
  }

  const label = assignee ? `${assignee.first_name} ${assignee.last_name}` : null

  if (!canEdit) {
    return label ? <PersonBadge name={label} /> : <span className="text-gray-400">—</span>
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors whitespace-nowrap" style={{ backgroundColor: '#fbfbfb' }}>
        {saving
          ? <span className="w-3 h-3 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          : label
            ? <>
                <span className="flex items-center justify-center rounded-full text-white font-bold shrink-0" style={{ backgroundColor: '#00d17e', width: 16, height: 16, fontSize: 9 }}>{label[0].toUpperCase()}</span>
                <span>{label}</span>
              </>
            : <span className="text-gray-400">{noAssigneeLabel}</span>
        }
        <ChevronDown className="w-3 h-3 shrink-0 text-gray-400 ml-0.5" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 right-0 w-44 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto py-1">
            <button onClick={() => pick(null)} className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-50 gap-2">
              <span className="flex-1 text-gray-400 italic">{noAssigneeLabel}</span>
              {!assigneeId && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
            </button>
            {users.map(u => (
              <button key={u.id} onClick={() => pick(u.id)} className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-50 gap-2">
                <span className="flex-1 text-gray-800 truncate">{u.first_name} {u.last_name}</span>
                {assigneeId === u.id && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CustomerCombo({ options, value, onChange, allLabel, placeholder }: {
  options: [string, string][]; value: string; onChange: (v: string) => void; allLabel: string; placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') } }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selectedLabel = value === 'all' ? '' : (options.find(([id]) => id === value)?.[1] ?? '')
  const filtered = options.filter(([, name]) => name.toLowerCase().includes(query.toLowerCase()))

  function pick(v: string) { onChange(v); setOpen(false); setQuery('') }

  return (
    <div className="relative min-w-[200px]" ref={ref}>
      <Search className="w-4 h-4 text-gray-900 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        value={open ? query : selectedLabel}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={value === 'all' ? placeholder : selectedLabel}
        className="w-full pl-9 pr-8 py-1 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      {value !== 'all' && !open && (
        <button onClick={() => pick('all')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"><X className="w-3.5 h-3.5" /></button>
      )}
      {open && (
        <div className="absolute z-20 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto py-1">
            <button onClick={() => pick('all')} className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-50">
              <span className="flex-1 text-gray-500">{allLabel}</span>
              {value === 'all' && <Check className="w-4 h-4 text-blue-600" />}
            </button>
            {filtered.map(([cid, name]) => (
              <button key={cid} onClick={() => pick(cid)} className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-50">
                <span className="flex-1 text-gray-900 truncate">{name}</span>
                {value === cid && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">—</p>}
          </div>
        </div>
      )}
    </div>
  )
}
