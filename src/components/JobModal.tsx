import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, MapPin, Euro } from 'lucide-react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Input from './ui/Input'
import { supabase } from '../lib/supabase'
import { toast } from './ui/Toast'
import { JOB_STATUSES, JOB_STATUS_LABEL, JOB_STATUS_COLOR, statusPatch, jobTitle, type JobRow } from '../lib/jobs'
import type { JobStatus } from '../types/database'

interface Props {
  job: JobRow | null
  onClose: () => void
  onSaved: () => void
  users: { id: string; first_name: string; last_name: string }[]
  canEdit: boolean
  lang: 'sl' | 'en'
  money: (n: number) => string
}

const L = {
  sl: { status: 'Status', start: 'Začetek del', end: 'Konec del', assignee: 'Izvajalec', none: 'Ni določen', notes: 'Opombe', notesHint: 'npr. material naročen, ključ pri hišniku', openQuote: 'Odpri ponudbo', save: 'Shrani', cancel: 'Prekliči', saved: 'Shranjeno', badRange: 'Konec del ne more biti pred začetkom.' },
  en: { status: 'Status', start: 'Start', end: 'End', assignee: 'Assigned to', none: 'Not assigned', notes: 'Notes', notesHint: 'e.g. material ordered, key with the caretaker', openQuote: 'Open quote', save: 'Save', cancel: 'Cancel', saved: 'Saved', badRange: 'The end date cannot be before the start date.' },
}

export default function JobModal({ job, onClose, onSaved, users, canEdit, lang, money }: Props) {
  const T = L[lang]
  const navigate = useNavigate()
  const [status, setStatus] = useState<JobStatus>('planned')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [assignee, setAssignee] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!job) return
    setStatus(job.status); setStart(job.start_date ?? ''); setEnd(job.end_date ?? '')
    setAssignee(job.assignee_id ?? ''); setNotes(job.notes ?? '')
  }, [job])

  const badRange = !!start && !!end && end < start

  async function save() {
    if (!job || badRange) return
    setSaving(true)
    const patch = {
      ...(status !== job.status ? statusPatch(job, status) : { updated_at: new Date().toISOString() }),
      start_date: start || null, end_date: end || null, assignee_id: assignee || null, notes: notes.trim() || null,
    }
    const { error } = await supabase.from('jobs').update(patch).eq('id', job.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(T.saved); onSaved(); onClose()
  }

  const selectCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50'

  return (
    <Modal open={!!job} onClose={onClose} title={job ? jobTitle(job) : ''} size="lg">
      {job && (
        <div className="flex flex-col gap-4">
          {/* What the job is */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-600">
            <span className="text-gray-400">{job.quotes?.quote_number}</span>
            {job.customers?.name && job.customers.name !== jobTitle(job) && <span>{job.customers.name}</span>}
            {job.quotes?.site_address && <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" />{job.quotes.site_address}</span>}
            <span className="inline-flex items-center gap-1.5 text-gray-900 font-medium"><Euro className="w-3.5 h-3.5 text-gray-400" />{money(Number(job.quotes?.total_net ?? 0))}</span>
            <button type="button" onClick={() => navigate(`/quotes/${job.quote_id}`)} className="ml-auto inline-flex items-center gap-1 text-blue-600 hover:text-blue-800">
              {T.openQuote}<ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Status as a segmented control */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{T.status}</span>
            <div className="inline-flex flex-wrap self-start rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {JOB_STATUSES.map(st => (
                <button key={st} type="button" disabled={!canEdit} onClick={() => setStatus(st)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${status === st ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: JOB_STATUS_COLOR[st].dot }} />
                  {JOB_STATUS_LABEL[lang][st]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input id="job-start" type="date" label={T.start} value={start} max={end || undefined} disabled={!canEdit} onChange={e => setStart(e.target.value)} />
            <Input id="job-end" type="date" label={T.end} value={end} min={start || undefined} disabled={!canEdit} onChange={e => setEnd(e.target.value)} error={badRange ? T.badRange : undefined} />
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="job-assignee" className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{T.assignee}</label>
              <select id="job-assignee" className={selectCls} value={assignee} disabled={!canEdit} onChange={e => setAssignee(e.target.value)}>
                <option value="">{T.none}</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="job-notes" className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{T.notes}</label>
              <textarea id="job-notes" rows={3} value={notes} disabled={!canEdit} onChange={e => setNotes(e.target.value)} placeholder={T.notesHint}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 -mx-6 px-6 border-t border-gray-200">
            <Button variant="secondary" onClick={onClose}>{T.cancel}</Button>
            {canEdit && <Button loading={saving} onClick={save} disabled={badRange}>{T.save}</Button>}
          </div>
        </div>
      )}
    </Modal>
  )
}
