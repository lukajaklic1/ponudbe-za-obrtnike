import { useEffect, useRef, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Plus, FileText, Check, ChevronDown, List, Columns3, Pencil, RefreshCw, Settings } from 'lucide-react'
import QuotesKanban from '../components/QuotesKanban'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { toast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import Button from '../components/ui/Button'
import Pagination, { usePageSize } from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { SearchBar, FilterTabs, IconButton } from '../components/ui/ListToolbar'
import { SortIcon } from '../components/ui/SortIcon'
import { FilterSelect } from '../components/ui/FilterSelect'
import { DateRangeFilter } from '../components/ui/DateRangeFilter'
import { Avatar } from '../components/ui/PersonBadge'
import { QuoteStatusBadge } from '../components/ui/QuoteStatusBadge'
import { isNewEnquiry } from '../lib/newEnquiry'
import type { Quote, QuoteStatus } from '../types/database'
import { format } from 'date-fns'
import { isDraftLike, isOpenOffer } from '../lib/quoteStatus'

interface CompanyUser { id: string; first_name: string; last_name: string; is_active?: boolean }


const STATUSES: QuoteStatus[] = ['enquiry', 'draft', 'issued', 'sent', 'downloaded', 'won', 'lost']

const VIEW_KEY = 'obrtdesk-quotes-view'

interface Row extends Quote { customers: { name: string; phone?: string | null; email?: string | null; customer_type?: 'person' | 'company' } | null; assignee: { first_name: string; last_name: string } | null }

export default function QuotesPage() {
  const { company, profile, hasPerm, loading: permLoading } = useCompany()
  const canEdit = hasPerm('quotes', 'create')
  const { t, lang } = useLanguage()
  const s = t.qp
  const navigate = useNavigate()
  const sl = lang === 'sl'
  // Days an open quote has been in its current status (null = final status: won / lost)
  const waitingDays = (q: Quote) => {
    const from = isDraftLike(q.status) || q.status === 'downloaded' ? q.created_at
      : q.status === 'issued' ? (q.issued_at ?? q.updated_at)
      : q.status === 'sent' ? (q.sent_at ?? q.issued_at ?? q.updated_at)
      : null
    if (!from) return null
    return Math.max(0, Math.floor((Date.now() - Date.parse(from)) / 86400000))
  }
  /** days since a quote was sent, shown next to its status so old ones stand out and get followed up */
  const sentAgo = (n: number) => {
    if (!sl) return n === 0 ? 'today' : n === 1 ? '1 day' : `${n} days`
    if (n === 0) return 'danes'
    const m = n % 100
    return `${n} ${m === 1 ? 'dan' : m === 2 ? 'dneva' : m === 3 || m === 4 ? 'dnevi' : 'dni'}`
  }
  const [rows, setRows] = useState<Row[]>([])
  const [allUsers, setAllUsers] = useState<CompanyUser[]>([])   // incl. inactive (they may have created quotes)
  const companyUsers = allUsers.filter(u => u.is_active !== false)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')   // user id, 'none' = unassigned
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')   // created_at range, yyyy-mm-dd
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize('quotes')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<'quote_number' | 'customer' | 'status' | 'waiting' | 'value' | 'created_at' | 'assignee'>('created_at')
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
    const { data } = await supabase.from('users').select('id, first_name, last_name, is_active').eq('company_id', company!.id).order('first_name')
    if (data) setAllUsers(data as CompanyUser[])
  }

  async function load() {
    if (!company) return
    // spinner only on first load (initial state) — reloads keep the current view on screen
    const { data: q } = await supabase.from('quotes').select('*, customers(name, phone, email, customer_type), assignee:users!assignee_id(first_name, last_name)').eq('company_id', company.id).order('created_at', { ascending: false })
    setRows((q as Row[]) ?? [])
    setLoading(false)
  }

  const filtered = rows.filter(r => {
    const assigneeName = r.assignee ? `${r.assignee.first_name} ${r.assignee.last_name}`.toLowerCase() : ''
    const q = search.toLowerCase()
    return (
      (statusFilter === 'all' || r.status === statusFilter) &&
      (!dateFrom || format(new Date(r.created_at), 'yyyy-MM-dd') >= dateFrom) &&
      (!dateTo || format(new Date(r.created_at), 'yyyy-MM-dd') <= dateTo) &&
      (assigneeFilter === 'all' || (assigneeFilter === 'none' ? !r.assignee_id : r.assignee_id === assigneeFilter)) &&
      (!search || r.quote_number.toLowerCase().includes(q) ||
        (r.customers?.name ?? '').toLowerCase().includes(q) ||
        (r.contact_person ?? '').toLowerCase().includes(q) ||
        (r.contact_email || r.customers?.email || '').toLowerCase().includes(q) ||
        (r.contact_phone || r.customers?.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
        (r.site_address ?? '').toLowerCase().includes(q) ||
        assigneeName.includes(q))
    )
  })

  const sortedFiltered = [...filtered].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'quote_number') return a.quote_number.localeCompare(b.quote_number) * mul
    if (sortKey === 'customer') return (a.customers?.name ?? '').localeCompare(b.customers?.name ?? '') * mul
    if (sortKey === 'status') {
      const d = (STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)) * mul
      if (d) return d
      return (waitingDays(b) ?? -1) - (waitingDays(a) ?? -1)
    }
    if (sortKey === 'waiting') {
      // quotes that aren't waiting always go last, whatever the direction
      const wa = waitingDays(a), wb = waitingDays(b)
      if (wa == null || wb == null) return wa == null ? (wb == null ? 0 : 1) : -1
      return (wa - wb) * mul
    }
    if (sortKey === 'value') return ((Number(a.total_net) || 0) - (Number(b.total_net) || 0)) * mul
    if (sortKey === 'created_at') return a.created_at.localeCompare(b.created_at) * mul
    if (sortKey === 'assignee') {
      // quotes without anybody assigned always go last
      const na = a.assignee ? `${a.assignee.first_name} ${a.assignee.last_name}` : '', nb = b.assignee ? `${b.assignee.first_name} ${b.assignee.last_name}` : ''
      if (!na || !nb) return !na ? (!nb ? 0 : 1) : -1
      return na.localeCompare(nb, 'sl') * mul
    }
    return 0
  })
  const paged = sortedFiltered.slice((page - 1) * pageSize, page * pageSize)
  const money = (n: number) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: company?.currency ?? 'EUR' })
  const openQuote = (q: Quote) => navigate(canEdit && isDraftLike(q.status) ? `/quotes/${q.id}/edit` : `/quotes/${q.id}`)


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
      <PageHeader title={s.quotes} icon={FileText}
        subtitle={sl ? 'Povpraševanja iz spletnega konfiguratorja in vaše ponudbe na enem mestu' : 'Enquiries from your online configurator and your quotes in one place'}
        action={<>
          <SearchBar compact value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder={sl ? 'Išči po številki, stranki, e-pošti …' : 'Search number, customer, email …'} />
          <IconButton icon={RefreshCw} label={sl ? 'Osveži' : 'Refresh'} onClick={() => load()} />
          {profile?.is_admin && <IconButton icon={Settings} label={t.nav.settings} onClick={() => navigate('/settings')} />}
          {canEdit && <Button onClick={() => navigate('/quotes/new')} className="gap-2 h-9 !py-0 rounded-[10px]"><Plus className="w-4 h-4" />{s.newQuote}</Button>}
        </>} />
      <div className="px-6 py-5">
      <FilterTabs<QuoteStatus | 'all'>
        tabs={[
          { key: 'all', label: t.common.all, count: rows.length },
          ...STATUSES.filter(st => rows.some(r => r.status === st)).map(st => ({ key: st, label: s.status[st], count: rows.filter(r => r.status === st).length })),
        ]}
        active={statusFilter}
        onChange={k => { setStatusFilter(k); setPage(1) }}
        right={<>
        <FilterSelect label={s.assignee} value={assigneeFilter === 'all' ? '' : assigneeFilter} allLabel={t.common.all}
          options={[
            ...allUsers.filter(u => u.is_active !== false || rows.some(r => r.assignee_id === u.id)).map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}` })),
            { value: 'none', label: s.noAssignee },
          ]}
          onChange={v => { setAssigneeFilter(v || 'all'); setPage(1) }} />
        <DateRangeFilter label={sl ? 'Ustvarjeno' : 'Created'} from={dateFrom} to={dateTo} onChange={(f, t2) => { setDateFrom(f); setDateTo(t2); setPage(1) }} />
        <div className="ml-auto inline-flex h-8 items-stretch gap-0.5 p-[3px] rounded-[11px] bg-[#f1f1f1]">
          {([['list', List, sl ? 'Seznam' : 'List'], ['kanban', Columns3, 'Kanban']] as const).map(([v, Icon, label]) => (
            <button key={v} type="button" title={label} aria-label={label} onClick={() => changeView(v)}
              className={`w-8 flex items-center justify-center rounded-[8px] transition-colors ${view === v ? 'bg-white text-black shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'text-[#667085] hover:text-black'}`}>
              <Icon className="w-[15px] h-[15px]" strokeWidth={1.75} />
            </button>
          ))}
        </div>
      </>} />

      {view === 'kanban' && !loading ? (
        <QuotesKanban
          statuses={STATUSES.filter(st => statusFilter === 'all' || st === statusFilter)}
          quotes={sortedFiltered} canEdit={canEdit} statusLabels={s.status} money={money} waitingDays={waitingDays}
          labels={{
            empty: sl ? 'Ni ponudb' : 'No quotes', total: sl ? 'Skupaj brez DDV' : 'Total excl. VAT',
            created: t.common.created, validUntil: sl ? 'Velja do' : 'Valid until', value: t.od.totalNet,
            assignee: s.assignee, noAssignee: s.noAssignee, customer: s.customer, site: t.od.siteAddress, phone: t.common.phone, inStatus: sl ? 'Dni v trenutnem statusu' : 'Days in current status',
          }}
          onOpen={openQuote} onMove={requestMove} />
      ) : (<>
      <div className="table-frame">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <FileText className="w-10 h-10 text-[#e8eef7] mb-3" />
            <p className="text-sm text-[#667085]">{s.noQuotes}</p>
          </div>
        ) : (
          <>
          {/* phones: one card per quote instead of the wide table */}
          <div className="sm:hidden divide-y divide-[#e4e9f2]">
            {paged.map(q => (
              <button key={q.id} type="button" onClick={() => navigate(canEdit && isDraftLike(q.status) ? `/quotes/${q.id}/edit` : `/quotes/${q.id}`)}
                className="w-full text-left px-4 py-3.5 hover:bg-[#f6f8fc] transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-black">{q.quote_number}{isNewEnquiry(q) && <span className="ml-2 inline-flex items-center px-[7px] py-[2px] rounded-lg text-xs font-semibold" style={{ color: '#000000', backgroundColor: '#e8eef7' }}>{sl ? 'Novo' : 'New'}</span>}</span>
                  <QuoteStatusBadge status={q.status} label={s.status[q.status]} />
                </div>
                <div className="text-[15px] font-medium text-black truncate mt-1">{q.customers?.name ?? '—'}</div>
                {q.site_address && <div className="text-[13px] font-medium text-[#667085] truncate">{q.site_address}</div>}
                <div className="flex items-center justify-between gap-2 mt-1.5 text-sm font-medium">
                  <span className="text-[#667085]">{format(new Date(q.created_at), 'd. M. yyyy')}</span>
                  <span className="text-black tabular-nums">{(Number(q.total_net) || 0).toLocaleString('de-DE', { style: 'currency', currency: company?.currency ?? 'EUR' })}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto"><table className="card-table w-full min-w-[820px]">
            <thead><tr>
              {([['quote_number', s.quoteNumber, '13%'], ['customer', s.customer, '27%'], ['status', t.common.status, '16%'], ['assignee', s.assignee, '13%'], ['created_at', t.common.created, '12%'], ['value', t.od.totalNet, '11%']] as [typeof sortKey, string, string][]).map(([key, h, w]) => (
                <th key={key} style={{ width: w }} className={`px-4 whitespace-nowrap cursor-pointer select-none ${key === 'value' ? 'text-right' : 'text-left'}`}
                  onClick={() => handleSort(key)}>
                  <span className="inline-flex items-center">{h}<SortIcon active={sortKey === key} dir={sortDir} /></span>
                </th>
              ))}
              <th className="w-[124px] px-4 text-right">{sl ? 'Dejanja' : 'Actions'}</th>
            </tr></thead>
            <tbody>
              {paged.map(q => {
                const view = () => navigate(`/quotes/${q.id}`)
                const created = new Date(q.created_at)
                const closed = ['won', 'accepted', 'lost', 'rejected', 'expired', 'frozen'].includes(q.status)
                return (
                <tr key={q.id} className="cursor-pointer" onClick={() => navigate(canEdit && isDraftLike(q.status) ? `/quotes/${q.id}/edit` : `/quotes/${q.id}`)}>
                  <td className="px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      {q.quote_number}
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: closed ? '#98a2b3' : '#22a55a' }}
                        title={isNewEnquiry(q) ? (sl ? 'Novo povpraševanje' : 'New enquiry') : closed ? (sl ? 'Zaključeno' : 'Closed') : (sl ? 'Odprto' : 'Open')} />
                      {isNewEnquiry(q) && <span className="text-[12px] text-[#1a7f37]">{sl ? 'Novo' : 'New'}</span>}
                    </span>
                  </td>
                  <td className="px-4 max-w-0">
                    <div className="truncate">{q.customers?.name ?? '—'}{q.site_address && <span className="text-[#667085]"> · {q.site_address}</span>}</div>
                  </td>
                  <td className="px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <QuoteStatusBadge status={q.status} label={s.status[q.status]} />
                      {isOpenOffer(q.status) && <span className="text-[13px] text-[#667085]" title={sl ? 'Dni od pošiljanja' : 'Days since sent'}>{sentAgo(waitingDays(q) ?? 0)}</span>}
                    </span>
                  </td>
                  <td className="px-4" onClick={e => e.stopPropagation()}>
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
                  <td className="px-4 whitespace-nowrap">{format(created, 'd. M. yyyy')} <span className="text-[#667085]">{format(created, 'HH:mm')}</span></td>
                  <td className="px-4 text-right tabular-nums whitespace-nowrap">{(Number(q.total_net) || 0).toLocaleString('de-DE', { style: 'currency', currency: company?.currency ?? 'EUR' })}</td>
                  <td className="px-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && isDraftLike(q.status) && <button type="button" onClick={() => navigate(`/quotes/${q.id}/edit`)} title={sl ? 'Uredi' : 'Edit'} aria-label={sl ? 'Uredi' : 'Edit'} className="icon-btn"><Pencil className="w-4 h-4" strokeWidth={1.75} /></button>}
                      <button type="button" onClick={view} className="h-8 px-2.5 rounded-lg text-[13px] font-medium text-black hover:bg-[#f6f8fc] transition-colors">{sl ? 'Ogled' : 'View'}</button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table></div>
          </>
        )}
      </div>

      <Pagination total={filtered.length} page={page} pageSize={pageSize} onChange={setPage} onPageSizeChange={setPageSize} />
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
    return label ? <span className="text-[14px] text-black whitespace-nowrap">{label}</span> : <span className="text-[#667085]">—</span>
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className="inline-flex items-center gap-2 -ml-1.5 pl-1.5 pr-1.5 py-1 rounded-md text-[14px] text-black hover:bg-[#e8eef7] transition-colors whitespace-nowrap">
        {saving
          ? <span className="w-3 h-3 border-2 border-[#e4e9f2] border-t-blue-500 rounded-full animate-spin" />
          : label
            ? <>
                <span>{label}</span>
              </>
            : <span className="text-[#667085]">{noAssigneeLabel}</span>
        }
        <ChevronDown className="w-3 h-3 shrink-0 text-[#667085] ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 left-0 w-60 bg-white border border-[#e4e9f2] rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto py-1">
            <button onClick={() => pick(null)} className="flex items-center w-full px-3 py-1.5 text-sm text-left hover:bg-[#f6f8fc] gap-2.5">
              <span className="w-[22px] h-[22px] rounded-full border border-dashed border-[#e8eef7] shrink-0" />
              <span className="flex-1 text-[#667085]">{noAssigneeLabel}</span>
              <Check className={`w-3.5 h-3.5 text-black shrink-0 ${!assigneeId ? '' : 'invisible'}`} />
            </button>
            {users.map(u => (
              <button key={u.id} onClick={() => pick(u.id)} className={`flex items-center w-full px-3 py-1.5 text-sm text-left hover:bg-[#f6f8fc] gap-2.5 ${assigneeId === u.id ? 'font-medium text-black' : 'text-black'}`}>
                <Avatar name={`${u.first_name} ${u.last_name}`} />
                <span className="flex-1 truncate">{u.first_name} {u.last_name}</span>
                <Check className={`w-3.5 h-3.5 text-black shrink-0 ${assigneeId === u.id ? '' : 'invisible'}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
