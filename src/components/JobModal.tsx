import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Receipt, Plus, Inbox } from 'lucide-react'
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_STYLE, displayStatus } from '../lib/invoices'
import type { Invoice } from '../types/database'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Input from './ui/Input'
import NumberInput from './ui/NumberInput'
import ConfirmDialog from './ui/ConfirmDialog'
import { supabase } from '../lib/supabase'
import { toast } from './ui/Toast'
import { JOB_STATUSES, JOB_STATUS_LABEL, JOB_STATUS_COLOR, statusPatch, jobTitle, jobSite, jobValue, jobWorkerIds, workerConflicts, dateRange, timeRange, type JobRow } from '../lib/jobs'
import type { JobStatus } from '../types/database'

interface Props {
  job: JobRow | null          // job to edit
  creating?: boolean          // or a new job added by hand (no quote)
  preset?: { start_date: string; end_date: string; start_time: string | null; end_time: string | null }   // new job from a calendar slot
  companyId: string
  onClose: () => void
  onSaved: () => void
  users: { id: string; first_name: string; last_name: string }[]
  allJobs?: JobRow[]          // to warn when a worker is already busy at that time
  canEdit: boolean
  isAdmin?: boolean
  lang: 'sl' | 'en'
}

const L = {
  sl: {
    newJob: 'Novo delo', newHint: 'Delo, za katerega niste izdali ponudbe (npr. manjše popravilo ali dogovor po telefonu).',
    title: 'Naziv dela', titleHint: 'npr. Beljenje stopnišča', customer: 'Stranka', noCustomer: 'Brez stranke', site: 'Lokacija del', siteHint: 'npr. Celovška 12, Ljubljana', value: 'Vrednost brez DDV',
    workers: 'Izvajalci', needStart: 'Za »V izvajanju« določite začetek del.', busy: (who: string, what: string, when: string) => `${who} ima ob tem času že delo »${what}« (${when}).`,
    invoicedLock: 'Status »Zaračunano« se nastavi z izdajo računa. Za vrnitev stornirajte račun.',
    plan: 'Razporeditev', status: 'Status', start: 'Začetek del', end: 'Konec del', assignee: 'Izvajalec', none: 'Ni določen',
    notes: 'Opombe', notesHint: 'npr. material naročen, ključ pri hišniku', openQuote: 'Odpri ponudbo', fromQuote: 'Iz ponudbe', save: 'Shrani', create: 'Dodaj delo', cancel: 'Prekliči',
    saved: 'Shranjeno', badRange: 'Konec del ne more biti pred začetkom.', fromTime: 'Od ure', toTime: 'Do ure', badTime: 'Ura konca mora biti po uri začetka.', manual: 'Dodano ročno',
    del: 'Izbriši', delTitle: 'Izbriši delo', delConfirm: 'Ali res želite izbrisati to delo? Tega ni mogoče razveljaviti.', deleted: 'Izbrisano',
    missing: 'Določite termin in izvajalca, da se delo prikaže v koledarju.',
    money: 'Računi in stroški', invoice: 'Izdaj račun', advance: 'Avansni račun', advanceShort: 'avans', draft: 'Osnutek',
    invoiced: 'Zaračunano (brez DDV)', costs: 'Stroški (brez DDV)', margin: 'Razlika', moneyHint: 'Stroške dodate v Prejetih računih, kjer račun povežete s tem delom.',
  },
  en: {
    newJob: 'New job', newHint: 'Work you did not send a quote for (e.g. a small repair or a phone agreement).',
    title: 'Job title', titleHint: 'e.g. Painting the staircase', customer: 'Customer', noCustomer: 'No customer', site: 'Site', siteHint: 'e.g. 12 Main St, Ljubljana', value: 'Value excl. VAT',
    workers: 'Workers', needStart: 'Set a start date to mark the job as in progress.', busy: (who: string, what: string, when: string) => `${who} already has "${what}" at that time (${when}).`,
    invoicedLock: '"Invoiced" is set by issuing an invoice. Cancel the invoice to undo it.',
    plan: 'Scheduling', status: 'Status', start: 'Start', end: 'End', assignee: 'Assigned to', none: 'Not assigned',
    notes: 'Notes', notesHint: 'e.g. material ordered, key with the caretaker', openQuote: 'Open quote', fromQuote: 'From quote', save: 'Save', create: 'Add job', cancel: 'Cancel',
    saved: 'Saved', badRange: 'The end date cannot be before the start date.', fromTime: 'From', toTime: 'To', badTime: 'The end time must be after the start time.', manual: 'Added by hand',
    del: 'Delete', delTitle: 'Delete job', delConfirm: 'Delete this job? This cannot be undone.', deleted: 'Deleted',
    missing: 'Set the dates and who does the work so the job shows in the calendar.',
    money: 'Invoices & costs', invoice: 'Issue invoice', advance: 'Advance invoice', advanceShort: 'advance', draft: 'Draft',
    invoiced: 'Invoiced (excl. VAT)', costs: 'Costs (excl. VAT)', margin: 'Difference', moneyHint: 'Add costs in Received invoices and link them to this job.',
  },
}

// Working hours in 15-minute steps, 05:00–22:00
const TIMES = Array.from({ length: (22 - 5) * 4 + 1 }, (_, i) => `${String(5 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`)
const DEFAULT_FROM = '08:00'
const DEFAULT_TO = '15:00'

const fmtMoney = (n: number) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

const selectCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50'
const labelCls = 'text-xs font-medium'

export default function JobModal({ job, creating = false, preset, allJobs = [], companyId, onClose, onSaved, users, canEdit, isAdmin = false, lang }: Props) {
  const T = L[lang]
  const navigate = useNavigate()
  const open = creating || !!job
  const manual = creating || (!!job && !job.quote_id)
  const [status, setStatus] = useState<JobStatus>('planned')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [fromTime, setFromTime] = useState('')
  const [toTime, setToTime] = useState('')
  const [workers, setWorkers] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  // manual jobs only
  const [title, setTitle] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [site, setSite] = useState('')
  const [value, setValue] = useState<number | null>(null)
  const [customers, setCustomers] = useState<{ id: string; name: string; address_street: string | null; address_city: string | null }[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  // money side of the job: invoices issued for it and supplier costs booked on it
  const [invoices, setInvoices] = useState<Pick<Invoice, 'id' | 'invoice_number' | 'kind' | 'status' | 'due_date' | 'total_net' | 'total_gross'>[]>([])
  const [costs, setCosts] = useState<{ net: number; count: number }>({ net: 0, count: 0 })

  useEffect(() => {
    if (!open) return
    setStatus(job?.status ?? 'planned'); setStart(job?.start_date ?? preset?.start_date ?? ''); setEnd(job?.end_date ?? preset?.end_date ?? '')
    // default working day 08:00–15:00 when no hours were set yet
    setFromTime(job?.start_time?.slice(0, 5) ?? preset?.start_time ?? DEFAULT_FROM); setToTime(job?.end_time?.slice(0, 5) ?? preset?.end_time ?? DEFAULT_TO)
    setWorkers(job ? jobWorkerIds(job) : []); setNotes(job?.notes ?? '')
    // quote jobs start from the quote's details; any change is stored on the job
    setTitle(job ? jobTitle(job) : ''); setCustomerId(job?.customer_id ?? ''); setSite(job ? (jobSite(job) ?? '') : '')
    setValue(job ? (job.value != null || job.quotes ? jobValue(job) : null) : null)
  }, [open, job])

  useEffect(() => {
    if (!open || customers.length) return
    supabase.from('customers').select('id, name, address_street, address_city').eq('company_id', companyId).order('name')
      .then(({ data }) => setCustomers((data as typeof customers) ?? []))
  }, [open])

  useEffect(() => {
    if (!open || !job) { setInvoices([]); setCosts({ net: 0, count: 0 }); return }
    const inv = supabase.from('invoices').select('id, invoice_number, kind, status, due_date, total_net, total_gross').eq('company_id', companyId)
    Promise.all([
      job.quote_id ? inv.or(`job_id.eq.${job.id},quote_id.eq.${job.quote_id}`) : inv.eq('job_id', job.id),
      supabase.from('purchase_invoices').select('total_net, total_gross').eq('job_id', job.id),
    ]).then(([{ data: i }, { data: b }]) => {
      setInvoices(((i as typeof invoices) ?? []).filter(x => x.status !== 'cancelled'))
      const bills = (b as { total_net: number | null; total_gross: number }[]) ?? []
      setCosts({ net: bills.reduce((a, x) => a + Number(x.total_net ?? x.total_gross), 0), count: bills.length })
    })
  }, [open, job])

  const conflicts = workerConflicts({ id: job?.id ?? '', start_date: start || null, end_date: end || null, start_time: fromTime || null, end_time: toTime || null }, workers, allJobs)
  // "Zaračunano" only comes from issuing an invoice; once invoiced, cancelling the invoice is the way back
  const lockedStatus = (st: JobStatus) => job?.status === 'invoiced' ? st !== 'invoiced' : st === 'invoiced'

  const badRange = !!start && !!end && end < start
  const badTime = !!fromTime && !!toTime && toTime <= fromTime
  const needStart = status === 'in_progress' && !start
  const canSave = !badRange && !badTime && !needStart && !!title.trim()

  function pickCustomer(id: string) {
    setCustomerId(id)
    // prefill the site with the customer's address when it is still empty
    const c = customers.find(x => x.id === id)
    if (c && !site.trim()) setSite([c.address_street, c.address_city].filter(Boolean).join(', '))
  }

  async function save() {
    if (!canSave) return
    setSaving(true)
    const common = { start_date: start || null, end_date: end || null, start_time: fromTime || null, end_time: toTime || null, assignee_id: workers[0] ?? null, assignee_ids: workers, notes: notes.trim() || null }
    // For a quote job, keep null where nothing changed so later quote edits still show through
    const fromQuote = job?.quotes
    const quoteTitle = job && fromQuote ? jobTitle({ ...job, title: null }) : null
    const own = {
      title: fromQuote && title.trim() === quoteTitle ? null : title.trim(),
      customer_id: customerId || null,
      site_address: fromQuote && site.trim() === (fromQuote.site_address ?? '') ? null : (site.trim() || null),
      value: fromQuote && value === Number(fromQuote.total_net) ? null : value,
    }
    let error
    if (creating) {
      const uid = (await supabase.auth.getUser()).data.user?.id ?? null
      const stamps = statusPatch({ started_at: null, finished_at: null } as never, status)
      ;({ error } = await supabase.from('jobs').insert({ company_id: companyId, quote_id: null, created_by: uid, ...stamps, status, ...common, ...own }))
    } else if (job) {
      const patch = { ...(status !== job.status ? statusPatch(job, status) : { updated_at: new Date().toISOString() }), ...common, ...own }
      ;({ error } = await supabase.from('jobs').update(patch).eq('id', job.id))
    }
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(T.saved); onSaved(); onClose()
  }

  async function remove() {
    if (!job) return
    const { error } = await supabase.from('jobs').delete().eq('id', job.id)
    setConfirmDel(false)
    if (error) { toast.error(error.message); return }
    toast.success(T.deleted); onSaved(); onClose()
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={creating ? T.newJob : job ? jobTitle(job) : ''} size="lg">
        <div className="flex flex-col gap-4">
          {creating && <p className="text-sm text-gray-500 -mt-1">{T.newHint}</p>}

          {/* Job from a quote: link back to it */}
          {job && !manual && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-600 -mt-1">
              <span className="text-gray-400">{T.fromQuote} {job.quotes?.quote_number}</span>
              <button type="button" onClick={() => navigate(`/quotes/${job.quote_id}`)} className="ml-auto inline-flex items-center gap-1 text-blue-600 hover:text-blue-800">
                {T.openQuote}<ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Details — editable for every job, so later changes can be recorded */}
          {(
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><Input id="job-title" label={T.title} placeholder={T.titleHint} value={title} disabled={!canEdit} onChange={e => setTitle(e.target.value)} autoFocus={creating} /></div>
              <div className="flex flex-col gap-1">
                <label htmlFor="job-customer" className={labelCls} style={{ color: '#7f7f7f' }}>{T.customer}</label>
                <select id="job-customer" className={selectCls} value={customerId} disabled={!canEdit} onChange={e => pickCustomer(e.target.value)}>
                  <option value="">{T.noCustomer}</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <NumberInput id="job-value" label={T.value} value={value} onValue={setValue} unit="€" decimals={2} />
              <div className="sm:col-span-2"><Input id="job-site" label={T.site} placeholder={T.siteHint} value={site} disabled={!canEdit} onChange={e => setSite(e.target.value)} /></div>
            </div>
          )}

          {/* Scheduling */}
          <div className="pt-4 border-t border-gray-100 flex flex-col gap-4">
            {!creating && job && (!job.start_date || !jobWorkerIds(job).length) && (job.status === 'planned' || job.status === 'in_progress') && (
              <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#e5eeff', color: '#215bcf' }}>{T.missing}</div>
            )}
            <div className="flex flex-col gap-1">
              <span className={labelCls} style={{ color: '#7f7f7f' }}>{T.status}</span>
              <div className="inline-flex flex-wrap self-start rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                {JOB_STATUSES.map(st => (
                  <button key={st} type="button" disabled={!canEdit || lockedStatus(st)} onClick={() => setStatus(st)} title={lockedStatus(st) ? T.invoicedLock : undefined}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed ${status === st ? 'bg-white text-gray-900 shadow-sm' : lockedStatus(st) ? 'text-gray-300' : 'text-gray-500 hover:text-gray-800'}`}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: JOB_STATUS_COLOR[st].dot }} />
                    {JOB_STATUS_LABEL[lang][st]}
                  </button>
                ))}
              </div>
              {(job?.status === 'invoiced' || status === 'invoiced') && <span className="text-xs text-gray-400 mt-1">{T.invoicedLock}</span>}
              {needStart && <span className="text-xs text-[#874d00] mt-1">{T.needStart}</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input id="job-start" type="date" label={T.start} value={start} max={end || undefined} disabled={!canEdit} onChange={e => setStart(e.target.value)} />
              <Input id="job-end" type="date" label={T.end} value={end} min={start || undefined} disabled={!canEdit} onChange={e => setEnd(e.target.value)} error={badRange ? T.badRange : undefined} />
              <TimeSelect id="job-from" label={T.fromTime} value={fromTime} disabled={!canEdit} onChange={setFromTime} />
              <TimeSelect id="job-to" label={T.toTime} value={toTime} disabled={!canEdit} onChange={setToTime} error={badTime ? T.badTime : undefined} />
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <span className={labelCls} style={{ color: '#7f7f7f' }}>{T.workers}</span>
                <div className="flex flex-wrap gap-1.5">
                  {users.map(u => {
                    const on = workers.includes(u.id)
                    const busy = conflicts.some(c => c.workerId === u.id)
                    return (
                      <button key={u.id} type="button" disabled={!canEdit}
                        onClick={() => setWorkers(w => on ? w.filter(x => x !== u.id) : [...w, u.id])}
                        className={`inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-sm transition-colors ${on ? (busy ? 'border-[#f5c9a6] bg-[#feeee1] text-[#9e3f00]' : 'border-[#c9dafd] bg-[#e5eeff] text-[#215bcf]') : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                        <span className="flex items-center justify-center rounded-full text-white font-bold shrink-0" style={{ backgroundColor: on ? (busy ? '#f97316' : '#3b82f6') : '#d1d5db', width: 20, height: 20, fontSize: 10 }}>{u.first_name[0]?.toUpperCase()}</span>
                        {u.first_name} {u.last_name}
                      </button>
                    )
                  })}
                  {users.length === 0 && <span className="text-sm text-gray-400">{T.none}</span>}
                </div>
                {conflicts.length > 0 && (
                  <div className="rounded-lg px-3 py-2 text-sm mt-1" style={{ backgroundColor: '#feeee1', color: '#9e3f00' }}>
                    {conflicts.map((c, i) => {
                      const u = users.find(x => x.id === c.workerId)
                      return <div key={i}>{T.busy(u ? `${u.first_name} ${u.last_name}` : '—', jobTitle(c.job), [dateRange(c.job.start_date, c.job.end_date), timeRange(c.job)].filter(Boolean).join(' · '))}</div>
                    })}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label htmlFor="job-notes" className={labelCls} style={{ color: '#7f7f7f' }}>{T.notes}</label>
                <textarea id="job-notes" rows={3} value={notes} disabled={!canEdit} onChange={e => setNotes(e.target.value)} placeholder={T.notesHint}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50" />
              </div>
            </div>
          </div>

          {/* Invoices & costs */}
          {job && (
            <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{T.money}</span>
                {canEdit && <div className="ml-auto flex gap-2">
                  {job.quote_id && <Button variant="secondary" size="sm" onClick={() => navigate(`/invoices/new?job=${job.id}&kind=advance`)} className="gap-1.5"><Plus className="w-3.5 h-3.5" />{T.advance}</Button>}
                  <Button size="sm" onClick={() => navigate(`/invoices/new?job=${job.id}`)} className="gap-1.5"><Receipt className="w-3.5 h-3.5" />{T.invoice}</Button>
                </div>}
              </div>
              {invoices.length > 0 && (
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {invoices.map(i => {
                    const d = displayStatus(i)
                    const st = INVOICE_STATUS_STYLE[d]
                    return (
                      <button key={i.id} type="button" onClick={() => navigate(i.status === 'draft' ? `/invoices/${i.id}/edit` : `/invoices/${i.id}`)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50">
                        <Receipt className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-900">{i.invoice_number ?? T.draft}</span>
                        {i.kind === 'advance' && <span className="text-xs text-gray-400">{T.advanceShort}</span>}
                        <span className="px-1.5 py-0.5 rounded-md text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.color }}>{INVOICE_STATUS_LABEL[lang][d]}</span>
                        <span className="ml-auto font-medium text-gray-900 tabular-nums">{fmtMoney(Number(i.total_gross))}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {[
                  [T.invoiced, invoices.filter(i => i.status !== 'draft').reduce((a, i) => a + Number(i.total_net), 0)],
                  [T.costs, costs.net],
                  [T.margin, invoices.filter(i => i.status !== 'draft').reduce((a, i) => a + Number(i.total_net), 0) - costs.net],
                ].map(([label, v], k) => (
                  <div key={k} className="rounded-lg bg-gray-50 px-3 py-2">
                    <div className="text-xs text-gray-500 flex items-center gap-1">{k === 1 && <Inbox className="w-3 h-3" />}{label as string}{k === 1 && costs.count ? ` (${costs.count})` : ''}</div>
                    <div className={`text-sm font-semibold tabular-nums ${k === 2 && (v as number) < 0 ? 'text-[#9e3f00]' : 'text-gray-900'}`}>{fmtMoney(v as number)}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 -mt-1">{T.moneyHint}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-4 -mx-6 px-6 border-t border-gray-200">
            <div>
              {/* Only hand-added jobs can be deleted; a quote's job follows the quote */}
              {job && manual && isAdmin && <Button variant="danger" onClick={() => setConfirmDel(true)}>{T.del}</Button>}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose}>{T.cancel}</Button>
              {canEdit && <Button loading={saving} onClick={save} disabled={!canSave}>{creating ? T.create : T.save}</Button>}
            </div>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={remove}
        title={T.delTitle} message={T.delConfirm} confirmLabel={T.del} danger />
    </>
  )
}

function TimeSelect({ id, label, value, onChange, disabled, error }: { id: string; label: string; value: string; onChange: (v: string) => void; disabled?: boolean; error?: string }) {
  // keep an off-grid time (set earlier) selectable
  const options = value && !TIMES.includes(value) ? [...TIMES, value].sort() : TIMES
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={labelCls} style={{ color: '#7f7f7f' }}>{label}</label>
      <select id={id} className={`${selectCls} ${error ? 'border-red-400 bg-red-50' : ''}`} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
