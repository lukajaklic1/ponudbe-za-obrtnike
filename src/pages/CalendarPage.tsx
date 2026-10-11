import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, CalendarX2, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterSelect } from '../components/ui/FilterSelect'
import Button from '../components/ui/Button'
import JobModal from '../components/JobModal'
import CalendarTimeGrid from '../components/CalendarTimeGrid'
import { JOB_STATUSES, JOB_STATUS_LABEL, JOB_STATUS_COLOR, loadJobs, jobTitle, jobSite, timeRange, type JobRow } from '../lib/jobs'

interface CompanyUser { id: string; first_name: string; last_name: string }
type View = 'month' | 'week' | 'day'

const L = {
  sl: {
    months: ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'],
    days: ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'],
    daysLong: ['Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota', 'Nedelja'],
    views: { month: 'Mesec', week: 'Teden', day: 'Dan' } as Record<View, string>,
    today: 'Danes', unscheduled: 'Brez termina', unscheduledHint: 'Kliknite delo in mu določite začetek in konec.', allScheduled: 'Vsa dela imajo termin.',
    assignee: 'Izvajalec', noAssignee: 'Ni določen', status: 'Status', all: 'Vsi', allDay: 'Ves dan', newJob: 'Novo delo',
  },
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    daysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    views: { month: 'Month', week: 'Week', day: 'Day' } as Record<View, string>,
    today: 'Today', unscheduled: 'Not scheduled', unscheduledHint: 'Click a job to set its start and end date.', allScheduled: 'Every job is scheduled.',
    assignee: 'Assigned to', noAssignee: 'Not assigned', status: 'Status', all: 'All', allDay: 'All day', newJob: 'New job',
  },
}

const VIEW_KEY = 'obrtdesk-calendar-view'

// Local-date helpers on yyyy-mm-dd strings (no time zones involved)
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const mondayOf = (d: Date) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7))
const jobStart = (j: JobRow) => (j.start_date ?? j.end_date)!
const jobEnd = (j: JobRow) => (j.end_date ?? j.start_date)!

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

  function changeView(v: View) { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* private mode */ } }

  useEffect(() => { if (company) { load(); loadUsers() } }, [company])
  async function load() { if (company) setJobs(await loadJobs(company.id)) }
  async function loadUsers() {
    const { data } = await supabase.from('users').select('id, first_name, last_name').eq('company_id', company!.id).eq('is_active', true).order('first_name')
    if (data) setUsers(data as CompanyUser[])
  }

  const today = iso(new Date())

  // Cancelled work is hidden unless asked for explicitly
  const visible = jobs.filter(j =>
    (statusFilter ? j.status === statusFilter : j.status !== 'cancelled') &&
    (!assigneeFilter || (assigneeFilter === 'none' ? !j.assignee_id : j.assignee_id === assigneeFilter)))
  const scheduled = visible.filter(j => j.start_date || j.end_date)
  const unscheduled = visible.filter(j => !j.start_date && !j.end_date && (j.status === 'planned' || j.status === 'in_progress'))

  // ── Navigation ──
  function step(dir: 1 | -1) {
    setCursor(c => view === 'month' ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : addDays(c, dir * (view === 'week' ? 7 : 1)))
  }
  function title() {
    if (view === 'month') return `${T.months[cursor.getMonth()]} ${cursor.getFullYear()}`
    if (view === 'day') return `${T.daysLong[(cursor.getDay() + 6) % 7]}, ${cursor.getDate()}. ${cursor.getMonth() + 1}. ${cursor.getFullYear()}`
    const m = mondayOf(cursor), s = addDays(m, 6)
    return `${m.getDate()}. ${m.getMonth() + 1}. – ${s.getDate()}. ${s.getMonth() + 1}. ${s.getFullYear()}`
  }

  // Weeks to draw: the whole month, or just the current week
  function weeks(): Date[][] {
    if (view === 'week') { const m = mondayOf(cursor); return [Array.from({ length: 7 }, (_, i) => addDays(m, i))] }
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

  const who = (j: JobRow) => j.assignee ? `${j.assignee.first_name} ${j.assignee.last_name}` : null

  if (!permLoading && !hasPerm('quotes', 'view')) return <Navigate to="/dashboard" replace />

  const isMonth = view === 'month'

  return (
    <div>
      <PageHeader title={lang === 'sl' ? 'Koledar' : 'Calendar'} icon={CalendarDays}
        action={canEdit && <Button onClick={() => { const d = iso(view === 'month' ? new Date() : cursor); setPreset({ start_date: d, end_date: d, start_time: null, end_time: null }) }} className="gap-2"><Plus className="w-4 h-4" />{T.newJob}</Button>} />
      <div className="p-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>{T.today}</Button>
          <div className="flex items-center">
            <button onClick={() => step(-1)} className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-[#f6f6f6]" aria-label="prev"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => step(1)} className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-[#f6f6f6]" aria-label="next"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <h2 className="text-base font-semibold text-gray-900 min-w-[150px] mr-2">{title()}</h2>
          <FilterSelect label={T.status} value={statusFilter} allLabel={T.all}
            options={JOB_STATUSES.map(st => ({ value: st, label: JOB_STATUS_LABEL[lang][st] }))} onChange={setStatusFilter} />
          <FilterSelect label={T.assignee} value={assigneeFilter} allLabel={T.all}
            options={[{ value: 'none', label: T.noAssignee }, ...users.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))]}
            onChange={setAssigneeFilter} />
          <div className="ml-auto inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(['month', 'week', 'day'] as View[]).map(v => (
              <button key={v} type="button" onClick={() => changeView(v)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                {T.views[v]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4">
          <div className="flex-1 min-w-0">
            {!isMonth ? (
              <CalendarTimeGrid
                days={view === 'day' ? [new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())] : Array.from({ length: 7 }, (_, i) => addDays(mondayOf(cursor), i))}
                jobs={scheduled} dayLabels={T.days} allDayLabel={T.allDay} canCreate={canEdit}
                onOpen={setOpen}
                onCreate={(date, time) => {
                  const [h, m] = time.split(':').map(Number)
                  const end = `${String(Math.min(h + 2, 22)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                  setPreset({ start_date: date, end_date: date, start_time: time, end_time: end })
                }}
                onDayClick={view === 'week' ? d => { setCursor(d); changeView('day') } : undefined} />
            ) : (
              /* ── Month grid ── */
              <div className="overflow-x-auto">
                <div className="min-w-[700px] rounded-xl border border-gray-200 overflow-hidden">
                  <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                    {T.days.map((d, i) => (
                      <div key={d} className={`px-2 py-2 text-xs font-medium ${i >= 5 ? 'text-gray-400' : 'text-gray-500'}`}>{d}</div>
                    ))}
                  </div>
                  {weeks().map((week, wi, all) => {
                    const segs = segmentsFor(week)
                    const lanes = segs.reduce((m, s) => Math.max(m, s.lane + 1), 0)
                    const laneH = isMonth ? 24 : 34
                    return (
                      <div key={wi} className={`relative ${wi < all.length - 1 ? 'border-b border-gray-200' : ''}`}>
                        <div className="absolute inset-0 grid grid-cols-7">
                          {week.map((_, i) => <div key={i} className={`${i < 6 ? 'border-r border-gray-100' : ''} ${i >= 5 ? 'bg-[#fcfcfc]' : ''}`} />)}
                        </div>
                        <div className="relative grid grid-cols-7 gap-y-1 pb-2"
                          style={{ minHeight: isMonth ? 112 : 420, gridTemplateRows: `${isMonth ? 'auto ' : '8px '}repeat(${Math.max(lanes, 1)}, ${laneH}px)` }}>
                          {isMonth && week.map((d, i) => {
                            const inMonth = d.getMonth() === cursor.getMonth()
                            const isToday = iso(d) === today
                            return (
                              <div key={i} className="px-2 pt-1.5 pb-0.5" style={{ gridColumn: i + 1, gridRow: 1 }}>
                                <button type="button" onClick={() => { setCursor(d); changeView('day') }}
                                  className={`inline-flex items-center justify-center text-xs w-6 h-6 rounded-full transition-colors
                                    ${isToday ? 'bg-blue-600 text-white font-semibold' : inMonth ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-100'}`}>{d.getDate()}</button>
                              </div>
                            )
                          })}
                          {segs.map(s => {
                            const c = JOB_STATUS_COLOR[s.job.status]
                            const name = who(s.job)
                            return (
                              <button key={`${s.job.id}-${wi}`} type="button" onClick={() => setOpen(s.job)}
                                title={`${timeRange(s.job) ? `${timeRange(s.job)} · ` : ''}${jobTitle(s.job)}${name ? ` · ${name}` : ''}`}
                                style={{ gridColumn: `${s.from + 1} / ${s.to + 2}`, gridRow: s.lane + 2, backgroundColor: c.bg, color: c.text }}
                                className={`mx-1 flex items-center gap-1.5 px-2 text-xs font-medium text-left truncate hover:brightness-95 transition
                                  ${s.startsHere ? 'rounded-l-md' : 'rounded-l-none'} ${s.endsHere ? 'rounded-r-md' : 'rounded-r-none'}`}>
                                {s.startsHere && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />}
                                {timeRange(s.job) && <span className="shrink-0 font-semibold">{s.job.start_time?.slice(0, 5)}</span>}
                                <span className="truncate">{jobTitle(s.job)}</span>
                                {!isMonth && jobSite(s.job) && <span className="truncate opacity-70 font-normal hidden lg:inline">· {jobSite(s.job)}</span>}
                                {name && <span className="ml-auto shrink-0 opacity-70 hidden lg:inline">{name.split(' ')[0]}</span>}
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

          {/* Jobs without dates */}
          <aside className="xl:w-72 shrink-0">
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="flex items-center gap-2 px-1 mb-2">
                <CalendarX2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">{T.unscheduled}</span>
                <span className="px-1.5 rounded-md text-xs font-medium" style={{ backgroundColor: '#e5eeff', color: '#215bcf' }}>{unscheduled.length}</span>
              </div>
              {unscheduled.length === 0
                ? <p className="px-1 py-3 text-xs text-gray-400">{T.allScheduled}</p>
                : <>
                    <p className="px-1 mb-2 text-xs text-gray-400">{T.unscheduledHint}</p>
                    <div className="flex flex-col gap-2">
                      {unscheduled.map(j => (
                        <button key={j.id} type="button" onClick={() => setOpen(j)}
                          className="text-left rounded-lg border border-gray-200 bg-white px-3 py-2 hover:border-gray-300 transition-colors">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: JOB_STATUS_COLOR[j.status].dot }} />
                            <span className="text-sm font-medium text-gray-900 truncate">{jobTitle(j)}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 truncate">{[j.quotes?.quote_number, jobSite(j)].filter(Boolean).join(' · ')}</div>
                        </button>
                      ))}
                    </div>
                  </>}
            </div>
          </aside>
        </div>
      </div>

      {company && <JobModal job={open} creating={!!preset} preset={preset ?? undefined} companyId={company.id} onClose={() => { setOpen(null); setPreset(null) }} onSaved={load}
        users={users} canEdit={canEdit} isAdmin={isAdmin} lang={lang} />}
    </div>
  )
}
