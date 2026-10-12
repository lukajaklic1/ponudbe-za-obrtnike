import { supabase } from './supabase'
import type { Job, JobStatus } from '../types/database'

// A job (realizacija) with what the board and calendar show from its quote
export interface JobRow extends Job {
  quotes: { quote_number: string; title: string | null; site_address: string | null; total_net: number; contact_phone?: string | null } | null
  customers: { name: string; phone?: string | null } | null
  assignee: { first_name: string; last_name: string } | null
}

export const JOB_STATUSES: JobStatus[] = ['planned', 'in_progress', 'done', 'invoiced', 'cancelled']

export const JOB_STATUS_LABEL: Record<'sl' | 'en', Record<JobStatus, string>> = {
  sl: { planned: 'Planirano', in_progress: 'V izvajanju', done: 'Končano', invoiced: 'Zaračunano', cancelled: 'Odpovedano' },
  en: { planned: 'Planned', in_progress: 'In progress', done: 'Done', invoiced: 'Invoiced', cancelled: 'Cancelled' },
}

// dot = solid colour (column headers, legend); bg/text = calendar bars
export const JOB_STATUS_COLOR: Record<JobStatus, { dot: string; bg: string; text: string }> = {
  planned:     { dot: '#8b5cf6', bg: '#f3edff', text: '#6b3fc9' },
  in_progress: { dot: '#3b82f6', bg: '#e5eeff', text: '#215bcf' },
  done:        { dot: '#10b981', bg: '#e0fced', text: '#098259' },
  invoiced:    { dot: '#9ca3af', bg: '#f3f4f6', text: '#4b5563' },
  cancelled:   { dot: '#f97316', bg: '#feeee1', text: '#9e3f00' },
}

export async function loadJobs(companyId: string): Promise<JobRow[]> {
  const { data } = await supabase.from('jobs')
    .select('*, quotes(quote_number, title, site_address, total_net, contact_phone), customers(name, phone), assignee:users!assignee_id(first_name, last_name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  return (data as JobRow[]) ?? []
}

// Status change also stamps when the work actually started / finished
export function statusPatch(job: Job, to: JobStatus): Partial<Job> {
  const now = new Date().toISOString()
  const patch: Partial<Job> = { status: to, updated_at: now }
  if (to === 'in_progress' && !job.started_at) patch.started_at = now
  if ((to === 'done' || to === 'invoiced') && !job.finished_at) patch.finished_at = now
  if (to === 'planned' || to === 'in_progress') patch.finished_at = null
  return patch
}

// A job's own title / site / value win (manual jobs, or later changes); otherwise they come from the quote
export const jobTitle = (j: JobRow) =>
  j.title ?? (j.quotes?.title && j.quotes.title !== j.customers?.name ? j.quotes.title : (j.customers?.name ?? j.quotes?.quote_number ?? '—'))
export const jobSite = (j: JobRow) => j.site_address ?? j.quotes?.site_address ?? null
export const jobPhone = (j: JobRow) => j.quotes?.contact_phone || j.customers?.phone || null
export const jobValue = (j: JobRow) => Number(j.value ?? j.quotes?.total_net ?? 0)
// Still waiting to be scheduled: no dates or nobody assigned (only while the work is ahead)
export const needsPlanning = (j: JobRow): boolean =>
  (j.status === 'planned' || j.status === 'in_progress') && (!j.start_date || !jobWorkerIds(j).length)

// "12. 10." or "12. 10. – 15. 10. 2026"
export function dateRange(start: string | null, end: string | null): string | null {
  const f = (d: string, year: boolean) => { const [y, m, day] = d.split('-'); return `${Number(day)}. ${Number(m)}.${year ? ` ${y}` : ''}` }
  if (!start && !end) return null
  if (start && end && start !== end) return `${f(start, false)} – ${f(end, true)}`
  return f((start ?? end)!, true)
}

// "08:00–12:00" / "od 08:00" (optional working hours)
export function timeRange(j: Pick<JobRow, 'start_time' | 'end_time'>): string | null {
  const s = j.start_time?.slice(0, 5), e = j.end_time?.slice(0, 5)
  if (s && e) return `${s}–${e}`
  return s ?? (e ? `–${e}` : null)
}

// Workers on a job (falls back to the legacy single assignee)
export const jobWorkerIds = (j: Pick<JobRow, 'assignee_ids' | 'assignee_id'>): string[] =>
  j.assignee_ids?.length ? j.assignee_ids : j.assignee_id ? [j.assignee_id] : []

type Person = { id: string; first_name: string; last_name: string }
export const jobWorkers = (j: Pick<JobRow, 'assignee_ids' | 'assignee_id'>, users: Person[]): Person[] =>
  jobWorkerIds(j).map(id => users.find(u => u.id === id)).filter((u): u is Person => !!u)

// Work should be finished by now but isn't
export const isLate = (j: JobRow) => {
  const end = j.end_date ?? j.start_date
  if (!end || !(j.status === 'planned' || j.status === 'in_progress')) return false
  const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return end < today
}
export const lateDays = (j: JobRow) => {
  const end = j.end_date ?? j.start_date
  return end ? Math.max(0, Math.round((Date.now() - new Date(`${end}T23:59:59`).getTime()) / 86400000) + 1) : 0
}

export const mapsUrl = (address: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`

// Same worker on two jobs at the same time (dates overlap and hours overlap, or one has no hours)
export function workerConflicts(job: Pick<JobRow, 'id' | 'start_date' | 'end_date' | 'start_time' | 'end_time'>, workerIds: string[], all: JobRow[]): { workerId: string; job: JobRow }[] {
  const s = job.start_date ?? job.end_date, e = job.end_date ?? job.start_date
  if (!s || !e || !workerIds.length) return []
  const t = (x: string | null | undefined) => x ? x.slice(0, 5) : null
  const out: { workerId: string; job: JobRow }[] = []
  for (const o of all) {
    if (o.id === job.id || o.status === 'cancelled' || o.status === 'invoiced' || o.status === 'done') continue
    const os = o.start_date ?? o.end_date, oe = o.end_date ?? o.start_date
    if (!os || !oe || os > e || oe < s) continue
    const a1 = t(job.start_time), a2 = t(job.end_time), b1 = t(o.start_time), b2 = t(o.end_time)
    if (a1 && a2 && b1 && b2 && (a2 <= b1 || b2 <= a1)) continue   // same days, different hours
    for (const w of workerIds) if (jobWorkerIds(o).includes(w)) out.push({ workerId: w, job: o })
  }
  return out
}
