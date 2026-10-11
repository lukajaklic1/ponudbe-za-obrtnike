import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, CalendarX2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterSelect } from '../components/ui/FilterSelect'
import Button from '../components/ui/Button'
import JobModal from '../components/JobModal'
import { JOB_STATUSES, JOB_STATUS_LABEL, JOB_STATUS_COLOR, loadJobs, jobTitle, type JobRow } from '../lib/jobs'

interface CompanyUser { id: string; first_name: string; last_name: string }

const L = {
  sl: {
    months: ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'],
    days: ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'],
    today: 'Danes', unscheduled: 'Brez termina', unscheduledHint: 'Kliknite delo in mu določite začetek in konec.', allScheduled: 'Vsa dela imajo termin.',
    assignee: 'Izvajalec', noAssignee: 'Ni določen', status: 'Status',
  },
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    today: 'Today', unscheduled: 'Not scheduled', unscheduledHint: 'Click a job to set its start and end date.', allScheduled: 'Every job is scheduled.',
    assignee: 'Assigned to', noAssignee: 'Not assigned', status: 'Status',
  },
}

// Local-date helpers on yyyy-mm-dd strings (no time zones involved)
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

interface Segment { job: JobRow; from: number; to: number; lane: number; startsHere: boolean; endsHere: boolean }

export default function CalendarPage() {
  const { company, hasPerm, loading: permLoading } = useCompany()
  const canEdit = hasPerm('quotes', 'create')
  const { lang } = useLanguage()
  const T = L[lang]
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [open, setOpen] = useState<JobRow | null>(null)

  useEffect(() => { if (company) { load(); loadUsers() } }, [company])
  async function load() { if (company) setJobs(await loadJobs(company.id)) }
  async function loadUsers() {
    const { data } = await supabase.from('users').select('id, first_name, last_name').eq('company_id', company!.id).eq('is_active', true).order('first_name')
    if (data) setUsers(data as CompanyUser[])
  }

  const money = (n: number) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: company?.currency ?? 'EUR' })
  const today = iso(new Date())

  const visible = jobs.filter(j =>
    (!assigneeFilter || (assigneeFilter === 'none' ? !j.assignee_id : j.assignee_id === assigneeFilter)) &&
    (!statusFilter || j.status === statusFilter))
  const scheduled = visible.filter(j => j.start_date || j.end_date)
  const unscheduled = visible.filter(j => !j.start_date && !j.end_date)

  // Monday-first weeks covering the whole month
  const weeks = useMemo(() => {
    const first = new Date(month)
    const start = addDays(first, -((first.getDay() + 6) % 7))
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const out: Date[][] = []
    for (let d = start; d <= last || out.length < 5; d = addDays(d, 7)) {
      out.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)))
      if (out.length === 6) break
    }
    return out
  }, [month])

  // Jobs cut into one bar per week, stacked into lanes so they never overlap
  function segmentsFor(week: Date[]): Segment[] {
    const ws = iso(week[0]), we = iso(week[6])
    const segs = scheduled
      .map(job => ({ job, s: job.start_date ?? job.end_date!, e: job.end_date ?? job.start_date! }))
      .filter(x => x.s <= we && x.e >= ws)
      .map(x => {
        const from = x.s < ws ? 0 : week.findIndex(d => iso(d) === x.s)
        const to = x.e > we ? 6 : week.findIndex(d => iso(d) === x.e)
        return { job: x.job, from, to, lane: 0, startsHere: x.s >= ws, endsHere: x.e <= we }
      })
      .sort((a, b) => a.from - b.from || (b.to - b.from) - (a.to - a.from))
    const laneEnds: number[] = []
    for (const s of segs) {
      let lane = laneEnds.findIndex(end => end < s.from)
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(s.to) } else laneEnds[lane] = s.to
      s.lane = lane
    }
    return segs
  }

  if (!permLoading && !hasPerm('quotes', 'view')) return <Navigate to="/dashboard" replace />

  return (
    <div>
      <PageHeader title={lang === 'sl' ? 'Koledar' : 'Calendar'} icon={CalendarDays} />
      <div className="p-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button variant="secondary" size="sm" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)) }}>{T.today}</Button>
          <div className="flex items-center">
            <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-[#f6f6f6]" aria-label="prev"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-[#f6f6f6]" aria-label="next"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <h2 className="text-base font-semibold text-gray-900 min-w-[150px]">{T.months[month.getMonth()]} {month.getFullYear()}</h2>
          <FilterSelect label={T.status} value={statusFilter} allLabel={lang === 'sl' ? 'Vsi' : 'All'}
            options={JOB_STATUSES.map(st => ({ value: st, label: JOB_STATUS_LABEL[lang][st] }))} onChange={setStatusFilter} />
          <FilterSelect label={T.assignee} value={assigneeFilter} allLabel={lang === 'sl' ? 'Vsi' : 'All'}
            options={[{ value: 'none', label: T.noAssignee }, ...users.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))]}
            onChange={setAssigneeFilter} />
          <div className="ml-auto hidden md:flex items-center gap-3">
            {JOB_STATUSES.map(st => (
              <span key={st} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: JOB_STATUS_COLOR[st].dot }} />{JOB_STATUS_LABEL[lang][st]}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4">
          {/* Month grid */}
          <div className="flex-1 min-w-0 overflow-x-auto">
            <div className="min-w-[700px] rounded-xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                {T.days.map((d, i) => <div key={d} className={`px-2 py-2 text-xs font-medium ${i >= 5 ? 'text-gray-400' : 'text-gray-500'}`}>{d}</div>)}
              </div>
              {weeks.map((week, wi) => {
                const segs = segmentsFor(week)
                const lanes = segs.reduce((m, s) => Math.max(m, s.lane + 1), 0)
                return (
                  <div key={wi} className={`relative ${wi < weeks.length - 1 ? 'border-b border-gray-200' : ''}`}>
                    {/* Day cells (background) */}
                    <div className="absolute inset-0 grid grid-cols-7">
                      {week.map((_, i) => (
                        <div key={i} className={`${i < 6 ? 'border-r border-gray-100' : ''} ${i >= 5 ? 'bg-[#fcfcfc]' : ''}`} />
                      ))}
                    </div>
                    {/* Day numbers + bars */}
                    <div className="relative grid grid-cols-7 gap-y-1 pb-2" style={{ minHeight: 112, gridTemplateRows: `auto repeat(${Math.max(lanes, 1)}, 24px)` }}>
                      {week.map((d, i) => {
                        const inMonth = d.getMonth() === month.getMonth()
                        const isToday = iso(d) === today
                        return (
                          <div key={i} className="px-2 pt-1.5 pb-0.5" style={{ gridColumn: i + 1, gridRow: 1 }}>
                            <span className={`inline-flex items-center justify-center text-xs w-6 h-6 rounded-full
                              ${isToday ? 'bg-blue-600 text-white font-semibold' : inMonth ? 'text-gray-700' : 'text-gray-300'}`}>{d.getDate()}</span>
                          </div>
                        )
                      })}
                      {segs.map(s => {
                        const c = JOB_STATUS_COLOR[s.job.status]
                        const who = s.job.assignee ? `${s.job.assignee.first_name} ${s.job.assignee.last_name}` : ''
                        return (
                          <button key={`${s.job.id}-${wi}`} type="button" onClick={() => setOpen(s.job)}
                            title={`${jobTitle(s.job)}${who ? ` · ${who}` : ''}`}
                            style={{ gridColumn: `${s.from + 1} / ${s.to + 2}`, gridRow: s.lane + 2, backgroundColor: c.bg, color: c.text }}
                            className={`mx-1 flex items-center gap-1.5 px-2 text-xs font-medium text-left truncate hover:brightness-95 transition
                              ${s.startsHere ? 'rounded-l-md' : 'rounded-l-none -ml-0'} ${s.endsHere ? 'rounded-r-md' : 'rounded-r-none -mr-0'}`}>
                            {s.startsHere && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />}
                            <span className="truncate">{jobTitle(s.job)}</span>
                            {who && <span className="ml-auto shrink-0 opacity-70 hidden lg:inline">{who.split(' ')[0]}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
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
                          <div className="text-xs text-gray-500 mt-0.5 truncate">{j.quotes?.quote_number}{j.quotes?.site_address ? ` · ${j.quotes.site_address}` : ''}</div>
                        </button>
                      ))}
                    </div>
                  </>}
            </div>
          </aside>
        </div>
      </div>

      <JobModal job={open} onClose={() => setOpen(null)} onSaved={load} users={users} canEdit={canEdit} lang={lang} money={money} />
    </div>
  )
}
