import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ClipboardCheck, Search, Building2, MapPin, Euro, CalendarDays, UserRound, Clock, Plus, List, Columns3, CalendarPlus, MoreVertical } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import Button from '../components/ui/Button'
import Pagination from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterSelect } from '../components/ui/FilterSelect'
import { SortIcon } from '../components/ui/SortIcon'
import JobModal from '../components/JobModal'
import { JOB_STATUSES, JOB_STATUS_LABEL, JOB_STATUS_COLOR, loadJobs, statusPatch, jobTitle, jobSite, jobValue, needsPlanning, dateRange, timeRange, type JobRow } from '../lib/jobs'
import type { JobStatus } from '../types/database'

interface CompanyUser { id: string; first_name: string; last_name: string }

const L = {
  sl: {
    newJob: 'Novo delo', empty: 'Ni del', noJobs: 'Ko ponudbo označite kot pridobljeno, se delo samodejno pojavi tukaj. Delo brez ponudbe dodate z gumbom »Novo delo«.',
    total: 'Skupaj brez DDV', noDate: 'Ni termina', setDate: 'Določi termin', addAssignee: 'Dodaj izvajalca', schedule: 'Razporedi delo',
    noAssignee: 'Ni določen', assignee: 'Izvajalec', inStatus: 'Dni v trenutnem statusu', customer: 'Stranka', site: 'Lokacija del', value: 'Vrednost', dates: 'Termin',
    job: 'Delo', status: 'Status', days: 'V statusu', manual: 'Brez ponudbe', toPlan: 'Za razporeditev',
  },
  en: {
    newJob: 'New job', empty: 'No jobs', noJobs: 'When you mark a quote as won, the job appears here automatically. Add work without a quote with "New job".',
    total: 'Total excl. VAT', noDate: 'Not scheduled', setDate: 'Set dates', addAssignee: 'Assign someone', schedule: 'Schedule job',
    noAssignee: 'Not assigned', assignee: 'Assigned to', inStatus: 'Days in current status', customer: 'Customer', site: 'Site', value: 'Value', dates: 'Dates',
    job: 'Job', status: 'Status', days: 'In status', manual: 'No quote', toPlan: 'To schedule',
  },
}

const PAGE_SIZE = 20
const VIEW_KEY = 'obrtdesk-jobs-view'
type SortKey = 'title' | 'dates' | 'status' | 'value' | 'days'

export default function JobsPage() {
  const { company, hasPerm, isAdmin, loading: permLoading } = useCompany()
  const canEdit = hasPerm('quotes', 'create')
  const { t, lang } = useLanguage()
  const T = L[lang]
  const [rows, setRows] = useState<JobRow[]>([])
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dragging, setDragging] = useState<JobRow | null>(null)
  const [overCol, setOverCol] = useState<JobStatus | null>(null)
  const [open, setOpen] = useState<JobRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('dates')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [view, setView] = useState<'list' | 'kanban'>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'kanban' } catch { return 'kanban' }
  })
  function changeView(v: 'list' | 'kanban') { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* private mode */ } }
  function handleSort(k: SortKey) { setSortKey(k); setSortDir(d => k === sortKey ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); setPage(1) }

  useEffect(() => { if (company) { load(); loadUsers() } }, [company])

  async function load() {
    if (!company) return
    setRows(await loadJobs(company.id))
    setLoading(false)
  }
  async function loadUsers() {
    const { data } = await supabase.from('users').select('id, first_name, last_name').eq('company_id', company!.id).eq('is_active', true).order('first_name')
    if (data) setUsers(data as CompanyUser[])
  }

  const money = (n: number) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: company?.currency ?? 'EUR' })

  // Planned: waiting since the job was created; in progress: since work started
  const daysInStatus = (j: JobRow) => {
    const from = j.status === 'planned' ? j.created_at : j.status === 'in_progress' ? (j.started_at ?? j.updated_at) : null
    return from ? Math.max(0, Math.floor((Date.now() - Date.parse(from)) / 86400000)) : null
  }
  const daysColor = (d: number) => d >= 14 ? '#9e3f00' : d >= 7 ? '#874d00' : '#6b7280'

  async function move(j: JobRow, to: JobStatus) {
    if (j.status === to) return
    const patch = statusPatch(j, to)
    setRows(prev => prev.map(r => r.id === j.id ? { ...r, ...patch } : r))   // optimistic
    const { error } = await supabase.from('jobs').update(patch).eq('id', j.id)
    if (error) { toast.error(error.message); setRows(prev => prev.map(r => r.id === j.id ? j : r)); return }
    toast.success(t.common.saved)
  }

  const q = search.toLowerCase()
  const filtered = rows.filter(j =>
    (!statusFilter || (statusFilter === 'toPlan' ? needsPlanning(j) : j.status === statusFilter)) &&
    (!assigneeFilter || (assigneeFilter === 'none' ? !j.assignee_id : j.assignee_id === assigneeFilter)) &&
    (!search || [j.quotes?.quote_number, jobTitle(j), jobSite(j), j.customers?.name].some(v => (v ?? '').toLowerCase().includes(q))))

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'title') return jobTitle(a).localeCompare(jobTitle(b)) * mul
    if (sortKey === 'status') return (JOB_STATUSES.indexOf(a.status) - JOB_STATUSES.indexOf(b.status)) * mul
    if (sortKey === 'value') return (jobValue(a) - jobValue(b)) * mul
    if (sortKey === 'days') {
      const da = daysInStatus(a), db = daysInStatus(b)
      if (da == null || db == null) return da == null ? (db == null ? 0 : 1) : -1
      return (da - db) * mul
    }
    // dates: scheduled first by start date, unscheduled always last
    if (!a.start_date || !b.start_date) return !a.start_date ? (!b.start_date ? b.created_at.localeCompare(a.created_at) : 1) : -1
    return a.start_date.localeCompare(b.start_date) * mul
  })
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const assigneeChip = (j: JobRow) => {
    const who = j.assignee ? `${j.assignee.first_name} ${j.assignee.last_name}` : null
    return who
      ? <span className="inline-flex items-center gap-1.5 min-w-0">
          <span className="flex items-center justify-center rounded-full text-white font-bold shrink-0" style={{ backgroundColor: '#00d17e', width: 18, height: 18, fontSize: 10 }}>{who[0].toUpperCase()}</span>
          <span className="truncate">{who}</span>
        </span>
      : null
  }

  if (!permLoading && !hasPerm('quotes', 'view')) return <Navigate to="/dashboard" replace />

  return (
    <div>
      <PageHeader title={t.nav.jobs} icon={ClipboardCheck} count={rows.length}
        action={canEdit && <Button onClick={() => setCreating(true)} className="gap-2"><Plus className="w-4 h-4" />{T.newJob}</Button>} />
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-900 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t.common.search}
              className="pl-9 pr-3 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
          </div>
          <FilterSelect label={T.status} value={statusFilter} allLabel={t.common.all}
            options={[{ value: 'toPlan', label: T.toPlan }, ...JOB_STATUSES.map(st => ({ value: st, label: JOB_STATUS_LABEL[lang][st] }))]}
            onChange={v => { setStatusFilter(v); setPage(1) }} />
          <FilterSelect label={T.assignee} value={assigneeFilter} allLabel={t.common.all}
            options={[{ value: 'none', label: T.noAssignee }, ...users.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))]}
            onChange={v => { setAssigneeFilter(v); setPage(1) }} />
          <div className="ml-auto inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {([['list', List, lang === 'sl' ? 'Seznam' : 'List'], ['kanban', Columns3, 'Kanban']] as const).map(([v, Icon, label]) => (
              <button key={v} type="button" title={label} aria-label={label} onClick={() => changeView(v)}
                className={`p-1 rounded-md transition-colors ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <ClipboardCheck className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 max-w-sm">{T.noJobs}</p>
          </div>
        ) : view === 'list' ? (
          /* ── Table ── */
          <>
            <div className="-mx-4 border-t border-b border-gray-200">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <ClipboardCheck className="w-10 h-10 text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">{T.empty}</p>
                </div>
              ) : (
                <div className="overflow-x-auto"><table className="w-full text-sm min-w-[920px]">
                  <thead className="bg-gray-50 border-b border-gray-200"><tr>
                    {([['title', T.job], ['', T.customer], ['', T.site], ['dates', T.dates], ['', T.assignee], ['status', T.status], ['days', T.days], ['value', T.value], ['', '']] as [SortKey | '', string][]).map(([key, h], i) => (
                      <th key={i} className={`text-left px-4 py-3 text-xs font-medium text-gray-500 ${key ? 'cursor-pointer select-none hover:text-gray-700' : ''}`}
                        onClick={() => key && handleSort(key)}>
                        <span className="inline-flex items-center gap-0.5">{h}{key && <SortIcon active={sortKey === key} dir={sortDir} />}</span>
                      </th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-200">
                    {paged.map(j => {
                      const c = JOB_STATUS_COLOR[j.status]
                      const range = dateRange(j.start_date, j.end_date)
                      const d = daysInStatus(j)
                      const active = j.status === 'planned' || j.status === 'in_progress'
                      return (
                        <tr key={j.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setOpen(j)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#e5eeff', border: '1px solid #d6e5ff' }}>
                                <ClipboardCheck className="w-3.5 h-3.5" style={{ color: '#215bcf' }} />
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-gray-900 truncate max-w-[240px]">{jobTitle(j)}</div>
                                <div className="text-xs text-gray-400">{j.quotes?.quote_number ?? T.manual}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-900">{j.customers?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{jobSite(j) ?? '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {range
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-200 text-xs text-gray-900" style={{ backgroundColor: '#fbfbfb' }}><CalendarDays className="w-3 h-3 text-gray-500" />{range}{timeRange(j) && ` · ${timeRange(j)}`}</span>
                              : active && canEdit
                                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600"><CalendarPlus className="w-3.5 h-3.5" />{T.setDate}</span>
                                : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {assigneeChip(j) ?? (active && canEdit
                              ? <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600"><Plus className="w-3.5 h-3.5" />{T.addAssignee}</span>
                              : <span className="text-gray-400">—</span>)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap" style={{ backgroundColor: c.bg, color: c.text }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />{JOB_STATUS_LABEL[lang][j.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {d == null ? <span className="text-gray-400">—</span>
                              : <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap" style={{ color: daysColor(d) }}><Clock className="w-3.5 h-3.5" />{d} d</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{money(jobValue(j))}</td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end">
                              <button onClick={() => setOpen(j)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><MoreVertical className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table></div>
              )}
            </div>
            <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
        ) : (
          /* ── Kanban ── */
          <div className="flex gap-3 overflow-x-auto pb-2">
            {JOB_STATUSES.filter(st => !statusFilter || statusFilter === 'toPlan' || st === statusFilter).map(st => {
              const cards = sorted.filter(j => j.status === st)
              const total = cards.reduce((s, j) => s + jobValue(j), 0)
              const droppable = !!dragging && canEdit && dragging.status !== st
              return (
                <div key={st}
                  onDragOver={e => { if (droppable) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverCol(st) } }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(c => (c === st ? null : c)) }}
                  onDrop={e => { e.preventDefault(); const j = dragging; setDragging(null); setOverCol(null); if (j && droppable) move(j, st) }}
                  className={`flex flex-col flex-1 min-w-[250px] max-h-[calc(100vh-210px)] rounded-xl transition-all duration-150
                    ${overCol === st ? 'bg-[#e6eefc] ring-2 ring-inset ring-blue-300' : droppable ? 'bg-[#eef3fc]' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: JOB_STATUS_COLOR[st].dot }} />
                    <span className="text-sm font-medium text-gray-900">{JOB_STATUS_LABEL[lang][st]}</span>
                    <span className="px-1.5 rounded-md text-xs font-medium" style={{ backgroundColor: '#e5eeff', color: '#215bcf' }}>{cards.length}</span>
                  </div>

                  <div className="flex-1 flex flex-col gap-2.5 px-2.5 pb-2.5 min-h-[140px] overflow-y-auto">
                    {cards.map(j => {
                      const title = jobTitle(j)
                      const range = dateRange(j.start_date, j.end_date)
                      const d = daysInStatus(j)
                      const active = j.status === 'planned' || j.status === 'in_progress'
                      const plan = canEdit && needsPlanning(j)
                      return (
                        <div key={j.id} draggable={canEdit}
                          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragging(j) }}
                          onDragEnd={() => { setDragging(null); setOverCol(null) }}
                          onClick={() => setOpen(j)}
                          className={`rounded-xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-[0_2px_6px_rgba(16,24,40,0.06)] transition-all
                            ${plan ? 'border-[#c9dafd] hover:border-[#a9c4fb]' : 'border-gray-200 hover:border-gray-300'}
                            ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${dragging?.id === j.id ? 'opacity-40' : ''}`}>
                          <div className="flex items-start gap-2">
                            <div className="w-5 h-5 mt-px rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: '#e5eeff', border: '1px solid #d6e5ff' }}>
                              <ClipboardCheck className="w-3 h-3" style={{ color: '#215bcf' }} />
                            </div>
                            <span className="text-sm font-medium text-gray-900 line-clamp-2">{title}</span>
                          </div>
                          <div className="flex flex-col gap-2.5 mt-3 text-sm text-gray-900">
                            {j.customers?.name && j.customers.name !== title && <Row icon={Building2} title={T.customer}>{j.customers.name}</Row>}
                            {jobSite(j) && <Row icon={MapPin} title={T.site}>{jobSite(j)}</Row>}
                            <Row icon={CalendarDays} title={T.dates}>
                              {range ? <>{range}{timeRange(j) && <span className="text-gray-500"> · {timeRange(j)}</span>}</> : (active && canEdit ? <span className="font-medium text-blue-600">+ {T.setDate}</span> : <span className="text-gray-400">{T.noDate}</span>)}
                            </Row>
                            <Row icon={Euro} title={T.value}><span className="font-medium">{money(jobValue(j))}</span></Row>
                            <Row icon={UserRound} title={T.assignee}>
                              {assigneeChip(j) ?? (active && canEdit ? <span className="font-medium text-blue-600">+ {T.addAssignee}</span> : <span className="text-gray-400">{T.noAssignee}</span>)}
                            </Row>
                          </div>
                          {plan && (
                            <button type="button" onClick={e => { e.stopPropagation(); setOpen(j) }}
                              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition-colors hover:brightness-95"
                              style={{ backgroundColor: '#e5eeff', color: '#215bcf' }}>
                              <CalendarPlus className="w-4 h-4" />{T.schedule}
                            </button>
                          )}
                          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100 text-xs text-gray-500">
                            <span>{j.quotes?.quote_number ?? T.manual}</span>
                            {d != null && (
                              <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap" title={T.inStatus} style={{ color: daysColor(d) }}>
                                <Clock className="w-3.5 h-3.5" />{d} d
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {cards.length === 0 && <p className="text-xs text-gray-400 text-center py-8">{T.empty}</p>}
                  </div>

                  <div className="px-3.5 pt-1.5 pb-3 text-xs text-gray-500">
                    <span className="font-medium text-gray-900">{money(total)}</span> · {T.total}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {company && <JobModal job={open} creating={creating} companyId={company.id} onClose={() => { setOpen(null); setCreating(false) }} onSaved={load}
        users={users} canEdit={canEdit} isAdmin={isAdmin} lang={lang} />}
    </div>
  )
}

function Row({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-w-0" title={title}>
      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  )
}
