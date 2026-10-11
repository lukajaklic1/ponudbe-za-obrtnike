import { supabase } from './supabase'
import type { Job, JobStatus } from '../types/database'

// A job (realizacija) with what the board and calendar show from its quote
export interface JobRow extends Job {
  quotes: { quote_number: string; title: string | null; site_address: string | null; total_net: number } | null
  customers: { name: string } | null
  assignee: { first_name: string; last_name: string } | null
}

export const JOB_STATUSES: JobStatus[] = ['planned', 'in_progress', 'done', 'invoiced']

export const JOB_STATUS_LABEL: Record<'sl' | 'en', Record<JobStatus, string>> = {
  sl: { planned: 'Planirano', in_progress: 'V izvajanju', done: 'Končano', invoiced: 'Zaračunano' },
  en: { planned: 'Planned', in_progress: 'In progress', done: 'Done', invoiced: 'Invoiced' },
}

// dot = solid colour (column headers, legend); bg/text = calendar bars
export const JOB_STATUS_COLOR: Record<JobStatus, { dot: string; bg: string; text: string }> = {
  planned:     { dot: '#8b5cf6', bg: '#f3edff', text: '#6b3fc9' },
  in_progress: { dot: '#3b82f6', bg: '#e5eeff', text: '#215bcf' },
  done:        { dot: '#10b981', bg: '#e0fced', text: '#098259' },
  invoiced:    { dot: '#9ca3af', bg: '#f3f4f6', text: '#4b5563' },
}

export async function loadJobs(companyId: string): Promise<JobRow[]> {
  const { data } = await supabase.from('jobs')
    .select('*, quotes(quote_number, title, site_address, total_net), customers(name), assignee:users!assignee_id(first_name, last_name)')
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

export const jobTitle = (j: JobRow) =>
  j.quotes?.title && j.quotes.title !== j.customers?.name ? j.quotes.title : (j.customers?.name ?? j.quotes?.quote_number ?? '—')

// "12. 10." or "12. 10. – 15. 10. 2026"
export function dateRange(start: string | null, end: string | null): string | null {
  const f = (d: string, year: boolean) => { const [y, m, day] = d.split('-'); return `${Number(day)}. ${Number(m)}.${year ? ` ${y}` : ''}` }
  if (!start && !end) return null
  if (start && end && start !== end) return `${f(start, false)} – ${f(end, true)}`
  return f((start ?? end)!, true)
}
