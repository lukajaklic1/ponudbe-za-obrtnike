import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, CalendarClock, CalendarPlus, Plus, Building2, MapPin, CheckCircle2, GripVertical } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterSelect } from '../components/ui/FilterSelect'
import Button from '../components/ui/Button'
import JobModal from '../components/JobModal'
import CalendarTimeGrid, { jobDuration } from '../components/CalendarTimeGrid'
import { JOB_STATUSES, JOB_STATUS_LABEL, JOB_STATUS_COLOR, loadJobs, jobTitle, jobSite, jobValue, timeRange, type JobRow } from '../lib/jobs'

interface CompanyUser { id: string; first_name: string; last_name: string }
type View = 'month' | 'week' | 'day'

const L = {
  sl: {
    months: ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'],
    days: ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'],
    daysLong: ['Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota', 'Nedelja'],
    views: { month: 'Mesec', week: 'Teden', day: 'Dan' } as Record<View, string>,
    today: 'Danes', toPlan: 'Za razporeditev', toPlanHint: 'Povlecite delo na koledar ali ga kliknite in mu določite termin.',
    allPlanned: 'Vse je razporejeno', allPlannedHint: 'Nova pridobljena dela se pojavijo tukaj.', setDate: 'Določi termin',
    assignee: 'Izvajalec', noAssignee: 'Ni določen', status: 'Status', all: 'Vsi', allDay: 'Ves dan', newJob: 'Novo delo', moved: 'Termin posodobljen',
  },
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    daysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    views: { month: 'Month', week: 'Week', day: 'Day' } as Record<View, string>,
    today: 'Today', toPlan: 'To schedule', toPlanHint: 'Drag a job onto the calendar, or click it to set the dates.',
    allPlanned: 'Everything is scheduled', allPlannedHint: 'New won jobs show up here.', setDate: 'Set dates',
    assignee: 'Assigned to', noAssignee: 'Not assigned', status: 'Status', all: 'All', allDay: 'All day', newJob: 'New job', moved: 'Dates updated',
  },
}

const VIEW_KEY = 'obrtdesk-calendar-view'
const DEFAULT_FROM = '08:00', DEFAULT_TO = '15:00'

// Local-date helpers on yyyy-mm-dd strings (no time zones involved)
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const mondayOf = (d: Date) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7))
const jobStart = (j: JobRow) => (j.start_date ?? j.end_date)!
const jobEnd = (j: JobRow) => (j.end_date ?? j.start_date)!
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

interface Segment { job: JobRow; from: number; to: number; lane: number; startsHere: boolean; endsHere: boolean }

export default function CalendarPage() {
  const { company, hasPerm, isAdmin, loading: permLoading } = useCompany()
  const canEdit = hasPerm('quotes', 'create')
  const { lang } = useLanguage()
  const T = L[lang]
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [cursor, setCursor] = useState(() => new Date())
  const [view, setView] = useState<View>(() => {
    try { const v = localStorage.getItem(VIEW_KEY); return v === 'week' || v === 'day' ? v : 'month' } catch { return 'month' }
  })
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [open, setOpen] = useState<JobRow | null>(null)
  const [preset, setPreset] = useState<{ start_date: string; end_date: string; start_time: string | null; end_time: string | null } | null>(null)
  const [dragJob, setDragJob] = useState<JobRow | null>(null)
  const [overDay, setOverDay] = useState<string | null>(null)   // month view drop target

  function changeView(v: View) { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* private mode */ } }

  useEffect(() => { if (company) { load(); loadUsers() } }, [company])
  async function load() { if (company) setJobs(await loadJobs(company.id)) }
  async function loadUsers() {
    const { data } = await supabase.from('users').select('id, first_name, last_name').eq('company_id', company!.id).eq('is_active', true).order('first_name')
    if (data) setUsers(data as CompanyUser[])
  }

  const today = iso(new Date())
  const money = (n: number) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: company?.currency ?? 'EUR' })

  // Cancelled work is hidden unless asked for explicitly
  const visible = jobs.filter(j =>
    (statusFilter ? j.status === statusFilter : j.status !== 'cancelled') &&
    (!assigneeFilter || (assigneeFilter === 'none' ? !j.assignee_id : j.assignee_id === assigneeFilter)))
  const scheduled = visible.filter(j => j.start_date || j.end_date)
  const unscheduled = visible.filter(j => !j.start_date && !j.end_date && (j.status === 'planned' || j.status === 'in_progress'))

  // Drop a job on a day (and time). Multi-day jobs keep their length; time 'keep' = month view.
  async function placeJob(j: JobRow, date: string, time: string | null | 'keep') {
    const span = j.start_date || j.end_date ? Math.round((parse(jobEnd(j)).getTime() - parse(jobStart(j)).getTime()) / 86400000) : 0
    const patch: Partial<JobRow> = { start_date: date, end_date: iso(addDays(parse(date), span)), updated_at: new Date().toISOString() }
    if (time === null) { patch.start_time = null; patch.end_time = null }
    else if (time === 'keep') {
      if (!j.start_date && !j.start_time) { patch.start_time = DEFAULT_FROM; patch.end_time = DEFAULT_TO }
    } else {
      patch.start_time = time
      patch.end_time = fmt(Math.min(23 * 60 + 45, toMin(time) + jobDuration(j)))
    }
    const same = patch.start_date === j.start_date && patch.end_date === j.end_date &&
      (patch.start_time === undefined || patch.start_time === j.start_time?.slice(0, 5)) && (patch.end_time === undefined || patch.end_time === j.end_time?.slice(0, 5))
    if (same) return
    setJobs(prev => prev.map(x => x.id === j.id ? { ...x, ...patch } : x))   // optimistic
    const { error } = await supabase.from('jobs').update(patch).eq('id', j.id)
    if (error) { toast.error(error.message); setJobs(prev => prev.map(x => x.id === j.id ? j : x)); return }
    toast.success(T.moved)
  }

  // ── Navigation ──
  function step(dir: 1 | -1) {
    setCursor(c => view === 'month' ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : addDays(c, dir * (view === 'week' ? 7 : 1)))
  }
  function title() {
    if (view === 'month') return <>{T.months[cursor.getMonth()]} <span className="text-gray-400 font-normal">{cursor.getFullYear()}</span></>
    if (view === 'day') return <>{T.daysLong[(cursor.getDay() + 6) % 7]}, {cursor.getDate()}. {cursor.getMonth() + 1}. <span className="text-gray-400 font-normal">{cursor.getFullYear()}</span></>
    const m = mondayOf(cursor), s = addDays(m, 6)
    return <>{m.getDate()}. {m.getMonth() + 1}. – {s.getDate()}. {s.getMonth() + 1}. <span className="text-gray-400 font-normal">{s.getFullYear()}</span></>
  }

  function monthWeeks(): Date[][] {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const out: Date[][] = []
    for (let d = mondayOf(first); d <= last && out.length < 6; d = addDays(d, 7)) out.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)))
    return out
  }

  // Jobs cut into one bar per week, stacked into lanes so they never overlap
  function segmentsFor(week: Date[]): Segment[] {
    const ws = iso(week[0]), we = iso(week[6])
    const segs = scheduled
      .filter(j => jobStart(j) <= we && jobEnd(j) >= ws)
      .map(job => {
        const s = jobStart(job), e = jobEnd(job)
        return {
          job, lane: 0, startsHere: s >= ws, endsHere: e <= we,
          from: s < ws ? 0 : week.findIndex(d => iso(d) === s),
          to: e > we ? 6 : week.findIndex(d => iso(d) === e),
        }
      })
      .sort((a, b) => a.from - b.from || (a.job.start_time ?? '99').localeCompare(b.job.start_time ?? '99') || (b.to - b.from) - (a.to - a.from))
    const laneEnds: number[] = []
    for (const s of segs) {
      let lane = laneEnds.findIndex(end => end < s.from)
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(s.to) } else laneEnds[lane] = s.to
      s.lane = lane
    }
    return segs
  }

  if (!permLoading && !hasPerm('quotes', 'view')) return <Navigate to="/dashboard" replace />

  const isMonth = view === 'month'

  return (
    <div>
      <PageHeader title={lang === 'sl' ? 'Koledar' : 'Calendar'} icon={CalendarDays}
        action={canEdit && <Button onClick={() => { const d = iso(isMonth ? new Date() : cursor); setPreset({ start_date: d, end_date: d, start_time: null, end_time: null }) }} className="gap-2"><Plus className="w-4 h-4" />{T.newJob}</Button>} />
      <div className="p-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
            <button onClick={() => step(-1)} className="px-2 py-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors" aria-label="prev"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCursor(new Date())} className="px-3 py-1 text-sm font-medium text-gray-900 border-x border-gray-200 hover:bg-gray-50 transition-colors">{T.today}</button>
            <button onClick={() => step(1)} className="px-2 py-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors" aria-label="next"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 min-w-[160px]">{title()}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label={T.status} value={statusFilter} allLabel={T.all}
              options={JOB_STATUSES.map(st => ({ value: st, label: JOB_STATUS_LABEL[lang][st] }))} onChange={setStatusFilter} />
            <FilterSelect label={T.assignee} value={assigneeFilter} allLabel={T.all}
              options={[{ value: 'none', label: T.noAssignee }, ...users.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))]}
              onChange={setAssigneeFilter} />
          </div>
          <div className="ml-auto inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(['month', 'week', 'day'] as View[]).map(v => (
              <button key={v} type="button" onClick={() => changeView(v)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                {T.views[v]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 items-start">
          <div className="flex-1 min-w-0 w-full">
            {!isMonth ? (
              <CalendarTimeGrid
                days={view === 'day' ? [new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())] : Array.from({ length: 7 }, (_, i) => addDays(mondayOf(cursor), i))}
                jobs={scheduled} dayLabels={T.days} allDayLabel={T.allDay} canEdit={canEdit}
                dragJob={dragJob} onDragJob={setDragJob}
                onOpen={setOpen}
                onPlace={(j, date, time) => placeJob(j, date, time)}
                onCreate={(date, time) => setPreset({ start_date: date, end_date: date, start_time: time, end_time: fmt(Math.min(22 * 60, toMin(time) + 120)) })}
                onDayClick={view === 'week' ? d => { setCursor(d); changeView('day') } : undefined} />
            ) : (
              /* ── Month ── */
              <div className="overflow-x-auto">
                <div className="min-w-[700px] rounded-xl border border-gray-200 overflow-hidden bg-white">
                  <div className="grid grid-cols-7 border-b border-gray-200">
                    {T.days.map((d, i) => (
                      <div key={d} className={`px-3 h-10 flex items-center text-[13px] ${i > 0 ? 'border-l border-gray-100' : ''} ${i >= 5 ? 'text-gray-400' : 'text-gray-500'}`}>{d}</div>
                    ))}
                  </div>
                  {monthWeeks().map((week, wi, all) => {
                    const segs = segmentsFor(week)
                    const lanes = segs.reduce((m, s) => Math.max(m, s.lane + 1), 0)
                    return (
                      <div key={wi} className={`relative ${wi < all.length - 1 ? 'border-b border-gray-100' : ''}`}
                        onDragOver={e => {
                          if (!dragJob || !canEdit) return
                          e.preventDefault()
                          const r = e.currentTarget.getBoundingClientRect()
                          setOverDay(iso(week[Math.min(6, Math.floor((e.clientX - r.left) / (r.width / 7)))]))
                        }}
                        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverDay(null) }}
                        onDrop={e => {
                          e.preventDefault()
                          const r = e.currentTarget.getBoundingClientRect()
                          const d = week[Math.min(6, Math.floor((e.clientX - r.left) / (r.width / 7)))]
                          if (dragJob) placeJob(dragJob, iso(d), 'keep')
                          setDragJob(null); setOverDay(null)
                        }}>
                        {/* Day cells (background) */}
                        <div className="absolute inset-0 grid grid-cols-7">
                          {week.map((d, i) => {
                            const isToday = iso(d) === today
                            return (
                              <div key={i} onClick={() => { setCursor(d); changeView('day') }}
                                className={`${i > 0 ? 'border-l border-gray-100' : ''} cursor-pointer transition-colors
                                  ${overDay === iso(d) ? 'bg-blue-50 ring-2 ring-inset ring-blue-300' : isToday ? 'bg-blue-50/30 hover:bg-blue-50/60' : i >= 5 ? 'bg-gray-50/60 hover:bg-gray-50' : 'hover:bg-gray-50/70'}`} />
                            )
                          })}
                        </div>
                        {/* Day numbers + bars */}
                        <div className="relative grid grid-cols-7 gap-y-1 pb-2 pointer-events-none"
                          style={{ minHeight: 118, gridTemplateRows: `auto repeat(${Math.max(lanes, 1)}, 24px)` }}>
                          {week.map((d, i) => {
                            const inMonth = d.getMonth() === cursor.getMonth()
                            const isToday = iso(d) === today
                            return (
                              <div key={i} className="px-2 pt-2 pb-1" style={{ gridColumn: i + 1, gridRow: 1 }}>
                                <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-1 rounded-md text-[13px] tabular-nums
                                  ${isToday ? 'bg-blue-600 text-white font-semibold' : inMonth ? 'text-gray-900 font-medium' : 'text-gray-300'}`}>{d.getDate()}</span>
                              </div>
                            )
                          })}
                          {segs.map(s => {
                            const c = JOB_STATUS_COLOR[s.job.status]
                            const tr = timeRange(s.job)
                            return (
                              <button key={`${s.job.id}-${wi}`} type="button" onClick={() => setOpen(s.job)}
                                draggable={canEdit} onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragJob(s.job) }} onDragEnd={() => { setDragJob(null); setOverDay(null) }}
                                title={`${tr ? `${tr} · ` : ''}${jobTitle(s.job)}`}
                                style={{ gridColumn: `${s.from + 1} / ${s.to + 2}`, gridRow: s.lane + 2, backgroundColor: c.bg, color: c.text, boxShadow: s.startsHere ? `inset 3px 0 0 ${c.dot}` : undefined }}
                                className={`pointer-events-auto mx-1 flex items-center gap-1.5 px-2 text-xs text-left truncate hover:brightness-[0.97] transition
                                  ${s.startsHere ? 'rounded-l-md' : 'rounded-l-none'} ${s.endsHere ? 'rounded-r-md' : 'rounded-r-none'} ${dragJob?.id === s.job.id ? 'opacity-40' : ''}`}>
                                {s.startsHere && s.job.start_time && <span className="shrink-0 opacity-75 tabular-nums">{s.job.start_time.slice(0, 5)}</span>}
                                <span className="truncate font-medium">{jobTitle(s.job)}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── To schedule ── */}
          <aside className="w-full xl:w-80 shrink-0 xl:sticky xl:top-4">
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#e5eeff', border: '1px solid #d6e5ff' }}>
                    <CalendarClock className="w-3.5 h-3.5" style={{ color: '#215bcf' }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{T.toPlan}</span>
                  <span className="px-1.5 rounded-md text-xs font-medium" style={{ backgroundColor: '#e5eeff', color: '#215bcf' }}>{unscheduled.length}</span>
                </div>
                {unscheduled.length > 0 && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{T.toPlanHint}</p>}
              </div>

              {unscheduled.length === 0 ? (
                <div className="flex flex-col items-center text-center px-4 py-8">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5" style={{ backgroundColor: '#e0fced' }}>
                    <CheckCircle2 className="w-5 h-5" style={{ color: '#098259' }} />
                  </div>
                  <p className="text-sm font-medium text-gray-900">{T.allPlanned}</p>
                  <p className="text-xs text-gray-500 mt-1">{T.allPlannedHint}</p>
                </div>
              ) : (
                <div className="p-2.5 flex flex-col gap-2 max-h-[calc(100vh-300px)] overflow-y-auto bg-gray-50">
                  {unscheduled.map(j => {
                    const c = JOB_STATUS_COLOR[j.status]
                    const title = jobTitle(j)
                    return (
                      <div key={j.id} draggable={canEdit}
                        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragJob(j) }}
                        onDragEnd={() => { setDragJob(null); setOverDay(null) }}
                        onClick={() => setOpen(j)}
                        className={`group rounded-xl border border-gray-200 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-gray-300 hover:shadow-[0_2px_6px_rgba(16,24,40,0.06)] transition-all
                          ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${dragJob?.id === j.id ? 'opacity-40' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-[11px] font-medium" style={{ backgroundColor: c.bg, color: c.text }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />{JOB_STATUS_LABEL[lang][j.status]}
                          </span>
                          <span className="text-[11px] text-gray-400">{j.quotes?.quote_number}</span>
                          {canEdit && <GripVertical className="w-4 h-4 text-gray-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                        <div className="text-sm font-semibold text-gray-900 mt-2 line-clamp-2">{title}</div>
                        <div className="flex flex-col gap-1.5 mt-2 text-[13px] text-gray-600">
                          {j.customers?.name && j.customers.name !== title && (
                            <div className="flex items-center gap-2 min-w-0"><Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" /><span className="truncate">{j.customers.name}</span></div>
                          )}
                          {jobSite(j) && <div className="flex items-center gap-2 min-w-0"><MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /><span className="truncate">{jobSite(j)}</span></div>}
                        </div>
                        <div className="flex items-center mt-3 pt-2.5 border-t border-gray-100">
                          <span className="text-[13px] font-medium text-gray-900">{money(jobValue(j))}</span>
                          {canEdit && (
                            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600 group-hover:text-blue-700">
                              <CalendarPlus className="w-3.5 h-3.5" />{T.setDate}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {company && <JobModal job={open} creating={!!preset} preset={preset ?? undefined} companyId={company.id} onClose={() => { setOpen(null); setPreset(null) }} onSaved={load}
        users={users} canEdit={canEdit} isAdmin={isAdmin} lang={lang} />}
    </div>
  )
}
