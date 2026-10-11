import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { HardHat, Search, Building2, MapPin, Euro, CalendarDays, UserRound, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterSelect } from '../components/ui/FilterSelect'
import JobModal from '../components/JobModal'
import { JOB_STATUSES, JOB_STATUS_LABEL, JOB_STATUS_COLOR, loadJobs, statusPatch, jobTitle, dateRange, type JobRow } from '../lib/jobs'
import type { JobStatus } from '../types/database'

interface CompanyUser { id: string; first_name: string; last_name: string }

const L = {
  sl: { empty: 'Ni del', noJobs: 'Ko ponudbo označite kot pridobljeno, se delo samodejno pojavi tukaj.', total: 'Skupaj brez DDV', noDate: 'Ni termina', noAssignee: 'Ni določen', assignee: 'Izvajalec', inStatus: 'Dni v trenutnem statusu', customer: 'Stranka', site: 'Lokacija del', value: 'Vrednost', dates: 'Termin' },
  en: { empty: 'No jobs', noJobs: 'When you mark a quote as won, the job appears here automatically.', total: 'Total excl. VAT', noDate: 'Not scheduled', noAssignee: 'Not assigned', assignee: 'Assigned to', inStatus: 'Days in current status', customer: 'Customer', site: 'Site', value: 'Value', dates: 'Dates' },
}

export default function JobsPage() {
  const { company, hasPerm, loading: permLoading } = useCompany()
  const canEdit = hasPerm('quotes', 'create')
  const { t, lang } = useLanguage()
  const T = L[lang]
  const [rows, setRows] = useState<JobRow[]>([])
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [dragging, setDragging] = useState<JobRow | null>(null)
  const [overCol, setOverCol] = useState<JobStatus | null>(null)
  const [open, setOpen] = useState<JobRow | null>(null)

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
    (!assigneeFilter || (assigneeFilter === 'none' ? !j.assignee_id : j.assignee_id === assigneeFilter)) &&
    (!search || [j.quotes?.quote_number, j.quotes?.title, j.quotes?.site_address, j.customers?.name].some(v => (v ?? '').toLowerCase().includes(q))))
  // Scheduled jobs first (by start date), unscheduled after
  const sorted = [...filtered].sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || b.created_at.localeCompare(a.created_at))

  if (!permLoading && !hasPerm('quotes', 'view')) return <Navigate to="/dashboard" replace />

  return (
    <div>
      <PageHeader title={t.nav.jobs} icon={HardHat} count={rows.length} />
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-900 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.common.search}
              className="pl-9 pr-3 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
          </div>
          <FilterSelect label={T.assignee} value={assigneeFilter} allLabel={t.common.all}
            options={[{ value: 'none', label: T.noAssignee }, ...users.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))]}
            onChange={setAssigneeFilter} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <HardHat className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 max-w-sm">{T.noJobs}</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {JOB_STATUSES.map(st => {
              const cards = sorted.filter(j => j.status === st)
              const total = cards.reduce((s, j) => s + (Number(j.quotes?.total_net) || 0), 0)
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
                      const who = j.assignee ? `${j.assignee.first_name} ${j.assignee.last_name}` : null
                      const d = daysInStatus(j)
                      return (
                        <div key={j.id} draggable={canEdit}
                          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragging(j) }}
                          onDragEnd={() => { setDragging(null); setOverCol(null) }}
                          onClick={() => setOpen(j)}
                          className={`rounded-xl border border-gray-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-gray-300 hover:shadow-[0_2px_6px_rgba(16,24,40,0.06)] transition-all
                            ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${dragging?.id === j.id ? 'opacity-40' : ''}`}>
                          <div className="flex items-start gap-2">
                            <div className="w-5 h-5 mt-px rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: JOB_STATUS_COLOR[st].bg }}>
                              <HardHat className="w-3 h-3" style={{ color: JOB_STATUS_COLOR[st].text }} />
                            </div>
                            <span className="text-sm font-medium text-gray-900 line-clamp-2">{title}</span>
                          </div>
                          <div className="flex flex-col gap-2.5 mt-3 text-sm text-gray-900">
                            {j.customers?.name && j.customers.name !== title && <Row icon={Building2} title={T.customer}>{j.customers.name}</Row>}
                            {j.quotes?.site_address && <Row icon={MapPin} title={T.site}>{j.quotes.site_address}</Row>}
                            <Row icon={CalendarDays} title={T.dates}>{range ?? <span className="text-gray-400">{T.noDate}</span>}</Row>
                            <Row icon={Euro} title={T.value}><span className="font-medium">{money(Number(j.quotes?.total_net))}</span></Row>
                            <Row icon={UserRound} title={T.assignee}>
                              {who
                                ? <span className="inline-flex items-center gap-1.5 min-w-0">
                                    <span className="flex items-center justify-center rounded-full text-white font-bold shrink-0" style={{ backgroundColor: '#00d17e', width: 18, height: 18, fontSize: 10 }}>{who[0].toUpperCase()}</span>
                                    <span className="truncate">{who}</span>
                                  </span>
                                : <span className="text-gray-400">{T.noAssignee}</span>}
                            </Row>
                          </div>
                          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100 text-xs text-gray-500">
                            <span>{j.quotes?.quote_number}</span>
                            {d != null && (
                              <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap" title={T.inStatus}
                                style={{ color: d >= 14 ? '#9e3f00' : d >= 7 ? '#874d00' : '#6b7280' }}>
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

      <JobModal job={open} onClose={() => setOpen(null)} onSaved={load} users={users} canEdit={canEdit} lang={lang} money={money} />
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
