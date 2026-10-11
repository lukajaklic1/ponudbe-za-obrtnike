import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Inbox, Search, Paperclip, UploadCloud, FileText, X, ExternalLink, Check, ClipboardCheck, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import NumberInput from '../components/ui/NumberInput'
import Modal from '../components/ui/Modal'
import Checkbox from '../components/ui/Checkbox'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterSelect } from '../components/ui/FilterSelect'
import { DateFilter } from '../components/ui/DateFilter'
import { SortIcon } from '../components/ui/SortIcon'
import { safeFileName } from './QuoteFormPage'
import { PURCHASE_CATEGORIES, PURCHASE_CATEGORY_LABEL, fmtDate, todayIso } from '../lib/invoices'
import { loadJobs, jobTitle, type JobRow } from '../lib/jobs'
import type { PurchaseInvoice, PurchaseCategory } from '../types/database'

interface Row extends PurchaseInvoice { jobs: { title: string | null; quotes: { title: string | null; quote_number: string } | null } | null }
type SortKey = 'supplier' | 'category' | 'issue' | 'due' | 'amount' | 'status'
const PAGE_SIZE = 20
const BUCKET = 'quotations'

const L = {
  sl: {
    title: 'Prejeti računi', add: 'Nov prejeti račun', edit: 'Prejeti račun', supplier: 'Dobavitelj', supplierVat: 'ID za DDV dobavitelja', number: 'Številka računa',
    category: 'Kategorija', issue: 'Datum računa', due: 'Rok plačila', gross: 'Znesek z DDV', vat: 'Od tega DDV', net: 'Brez DDV', job: 'Delo', noJob: 'Ni povezano z delom',
    jobHint: 'Povežite strošek z delom, da vidite stroške posameznega dela.', notes: 'Opombe', status: 'Status', paid: 'Plačan', unpaid: 'Neplačan', overdue: 'Zapadel',
    paidCheck: 'Račun je plačan', paidDate: 'Datum plačila', file: 'Datoteka računa', drop: 'Povlecite PDF ali sliko sem ali kliknite za izbiro', open: 'Odpri',
    save: 'Shrani', create: 'Dodaj račun', cancel: 'Prekliči', del: 'Izbriši', delTitle: 'Izbriši prejeti račun', delText: 'Ali res želite izbrisati ta račun in njegovo datoteko?',
    saved: 'Shranjeno', deleted: 'Izbrisano', markPaid: 'Plačano', empty: 'Ni prejetih računov', emptyHint: 'Shranite račune dobaviteljev (material, orodje, podizvajalci) in spremljajte, kaj morate še plačati.',
    unpaidK: 'Za plačilo', overdueK: 'Zapadlo', paidMonth: 'Plačano ta mesec', costsMonth: 'Stroški ta mesec', from: 'Od', to: 'Do', needSupplier: 'Vpišite dobavitelja in znesek.', tooBig: 'Datoteka je prevelika (največ 10 MB).',
  },
  en: {
    title: 'Received invoices', add: 'New received invoice', edit: 'Received invoice', supplier: 'Supplier', supplierVat: 'Supplier VAT ID', number: 'Invoice number',
    category: 'Category', issue: 'Invoice date', due: 'Due date', gross: 'Total incl. VAT', vat: 'of which VAT', net: 'Excl. VAT', job: 'Job', noJob: 'Not linked to a job',
    jobHint: 'Link the cost to a job to see what each job costs.', notes: 'Notes', status: 'Status', paid: 'Paid', unpaid: 'Unpaid', overdue: 'Overdue',
    paidCheck: 'This invoice is paid', paidDate: 'Payment date', file: 'Invoice file', drop: 'Drop a PDF or image here, or click to choose', open: 'Open',
    save: 'Save', create: 'Add invoice', cancel: 'Cancel', del: 'Delete', delTitle: 'Delete received invoice', delText: 'Delete this invoice and its file?',
    saved: 'Saved', deleted: 'Deleted', markPaid: 'Paid', empty: 'No received invoices', emptyHint: 'Keep supplier invoices (material, tools, subcontractors) and track what is still to be paid.',
    unpaidK: 'To pay', overdueK: 'Overdue', paidMonth: 'Paid this month', costsMonth: 'Costs this month', from: 'From', to: 'To', needSupplier: 'Enter the supplier and the amount.', tooBig: 'The file is too large (max 10 MB).',
  },
}

const overdue = (b: PurchaseInvoice) => b.status === 'unpaid' && !!b.due_date && b.due_date < todayIso()
const billStatus = (b: PurchaseInvoice) => b.status === 'paid' ? 'paid' : overdue(b) ? 'overdue' : 'unpaid'
const STATUS_STYLE = {
  paid: { bg: '#e0fced', border: '#d4f8e6', color: '#098259' },
  unpaid: { bg: '#e5eeff', border: '#d6e5ff', color: '#215bcf' },
  overdue: { bg: '#feeee1', border: '#fee0c8', color: '#9e3f00' },
}

export default function BillsPage() {
  const { company, hasPerm, isAdmin, loading: permLoading } = useCompany()
  const canEdit = hasPerm('quotes', 'create')
  const { t, lang } = useLanguage()
  const T = L[lang]
  const [rows, setRows] = useState<Row[]>([])
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('issue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [open, setOpen] = useState<Row | null>(null)
  const [creating, setCreating] = useState(false)
  function handleSort(k: SortKey) { setSortKey(k); setSortDir(d => k === sortKey ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); setPage(1) }

  useEffect(() => { if (company) { load(); loadJobs(company.id).then(setJobs) } }, [company])
  async function load() {
    const { data } = await supabase.from('purchase_invoices').select('*, jobs(title, quotes(title, quote_number))').eq('company_id', company!.id).order('created_at', { ascending: false })
    setRows((data as Row[]) ?? [])
    setLoading(false)
  }

  const money = (n: number) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: company?.currency ?? 'EUR' })
  const month = todayIso().slice(0, 7)
  const sum = (l: Row[]) => l.reduce((s, r) => s + Number(r.total_gross || 0), 0)
  const kp = {
    unpaid: rows.filter(r => r.status === 'unpaid'), overdue: rows.filter(overdue),
    paid: rows.filter(r => r.status === 'paid' && (r.paid_at ?? '').startsWith(month)), costs: rows.filter(r => (r.issue_date ?? r.created_at).startsWith(month)),
  }
  const kpis = [
    { label: T.unpaidK, rows: kp.unpaid, color: '#215bcf', bg: '#e5eeff' },
    { label: T.overdueK, rows: kp.overdue, color: '#9e3f00', bg: '#feeee1' },
    { label: T.paidMonth, rows: kp.paid, color: '#098259', bg: '#e0fced' },
    { label: T.costsMonth, rows: kp.costs, color: '#6b3fc9', bg: '#f3edff' },
  ]

  async function quickPaid(r: Row) {
    const patch = { status: 'paid' as const, paid_at: todayIso(), updated_at: new Date().toISOString() }
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, ...patch } : x))
    const { error } = await supabase.from('purchase_invoices').update(patch).eq('id', r.id)
    if (error) { toast.error(error.message); load(); return }
    toast.success(T.saved)
  }

  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
    if (error || !data) { toast.error(error?.message ?? 'Error'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const jobName = (r: Row) => r.jobs ? (r.jobs.title ?? r.jobs.quotes?.title ?? r.jobs.quotes?.quote_number ?? '—') : null
  const q = search.toLowerCase()
  const filtered = rows.filter(r =>
    (!statusFilter || billStatus(r) === statusFilter) && (!categoryFilter || r.category === categoryFilter) &&
    (!dateFrom || (r.issue_date ?? '') >= dateFrom) && (!dateTo || (r.issue_date ?? '') <= dateTo) &&
    (!search || [r.supplier_name, r.invoice_number, r.notes, jobName(r)].some(v => (v ?? '').toLowerCase().includes(q))))
  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'supplier') return a.supplier_name.localeCompare(b.supplier_name) * mul
    if (sortKey === 'category') return a.category.localeCompare(b.category) * mul
    if (sortKey === 'due') return (a.due_date ?? '').localeCompare(b.due_date ?? '') * mul
    if (sortKey === 'amount') return (Number(a.total_gross) - Number(b.total_gross)) * mul
    if (sortKey === 'status') return billStatus(a).localeCompare(billStatus(b)) * mul
    return ((a.issue_date ?? '').localeCompare(b.issue_date ?? '') || a.created_at.localeCompare(b.created_at)) * mul
  })
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (!permLoading && !hasPerm('quotes', 'view')) return <Navigate to="/dashboard" replace />

  return (
    <div>
      <PageHeader title={T.title} icon={Inbox} count={rows.length}
        action={canEdit && <Button onClick={() => setCreating(true)} className="gap-2"><Plus className="w-4 h-4" />{T.add}</Button>} />
      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {kpis.map(k => (
            <div key={k.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">{k.label}</span>
                <span className="px-2 py-0.5 rounded-md text-[13px] font-medium" style={{ backgroundColor: k.bg, color: k.color }}>{k.rows.length}</span>
              </div>
              <div className="text-xl font-semibold text-gray-900 mt-1.5 tabular-nums">{money(sum(k.rows))}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-900 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t.common.search}
              className="pl-9 pr-3 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
          </div>
          <FilterSelect label={T.status} value={statusFilter} allLabel={t.common.all}
            options={[{ value: 'unpaid', label: T.unpaid }, { value: 'overdue', label: T.overdue }, { value: 'paid', label: T.paid }]}
            onChange={v => { setStatusFilter(v); setPage(1) }} />
          <FilterSelect label={T.category} value={categoryFilter} allLabel={t.common.all}
            options={PURCHASE_CATEGORIES.map(c => ({ value: c, label: PURCHASE_CATEGORY_LABEL[lang][c] }))}
            onChange={v => { setCategoryFilter(v); setPage(1) }} />
          <DateFilter label={T.from} value={dateFrom} allLabel={t.common.all} max={dateTo || undefined} onChange={v => { setDateFrom(v); setPage(1) }} />
          <DateFilter label={T.to} value={dateTo} allLabel={t.common.all} min={dateFrom || undefined} onChange={v => { setDateTo(v); setPage(1) }} />
        </div>

        <div className="-mx-4 border-t border-b border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-center px-4">
              <Inbox className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">{T.empty}</p>
              {rows.length === 0 && <p className="text-sm text-gray-400 mt-1 max-w-sm">{T.emptyHint}</p>}
            </div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[980px]">
              <thead className="bg-gray-50 border-b border-gray-200"><tr>
                {([['supplier', T.supplier], ['category', T.category], ['issue', T.issue], ['due', T.due], ['', T.job], ['status', T.status], ['amount', T.gross], ['', '']] as [SortKey | '', string][]).map(([key, h], i) => (
                  <th key={i} className={`text-left px-4 py-3 text-xs font-medium text-gray-500 ${key ? 'cursor-pointer select-none hover:text-gray-700' : ''}`} onClick={() => key && handleSort(key)}>
                    <span className="inline-flex items-center gap-0.5">{h}{key && <SortIcon active={sortKey === key} dir={sortDir} />}</span>
                  </th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-200">
                {paged.map(r => {
                  const bs = billStatus(r)
                  const st = STATUS_STYLE[bs]
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setOpen(r)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#f3edff', border: '1px solid #e6dbff' }}>
                            <Inbox className="w-3.5 h-3.5" style={{ color: '#6b3fc9' }} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate max-w-[220px]">{r.supplier_name}</div>
                            {r.invoice_number && <div className="text-xs text-gray-400">{r.invoice_number}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{PURCHASE_CATEGORY_LABEL[lang][r.category]}</td>
                      <td className="px-4 py-3">
                        {r.issue_date ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-200 text-xs text-gray-900 whitespace-nowrap" style={{ backgroundColor: '#fbfbfb' }}><CalendarDays className="w-3 h-3 text-gray-500" />{fmtDate(r.issue_date)}</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap ${bs === 'overdue' ? 'text-[#9e3f00] font-medium' : 'text-gray-600'}`}>{fmtDate(r.due_date)}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                        {jobName(r) ? <span className="inline-flex items-center gap-1.5"><ClipboardCheck className="w-3.5 h-3.5 text-gray-400 shrink-0" /><span className="truncate">{jobName(r)}</span></span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap" style={{ backgroundColor: st.bg, border: `1px solid ${st.border}`, color: st.color }}>{T[bs]}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{money(Number(r.total_gross))}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && r.status === 'unpaid' && (
                            <button onClick={() => quickPaid(r)} title={T.markPaid}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#098259] hover:bg-[#e0fced] transition-colors"><Check className="w-3.5 h-3.5" />{T.markPaid}</button>
                          )}
                          {r.file_path && (
                            <button onClick={() => openFile(r.file_path!)} title={r.file_name ?? T.open} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><Paperclip className="w-4 h-4" /></button>
                          )}
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
      </div>

      {company && (
        <BillModal open={creating || !!open} bill={open} companyId={company.id} jobs={jobs} suppliers={[...new Set(rows.map(r => r.supplier_name))]}
          canEdit={canEdit} isAdmin={isAdmin} T={T} lang={lang} onOpenFile={openFile}
          onClose={() => { setOpen(null); setCreating(false) }} onSaved={load} />
      )}
    </div>
  )
}

function BillModal({ open, bill, companyId, jobs, suppliers, canEdit, isAdmin, T, lang, onOpenFile, onClose, onSaved }: {
  open: boolean; bill: Row | null; companyId: string; jobs: JobRow[]; suppliers: string[]; canEdit: boolean; isAdmin: boolean
  T: typeof L['sl']; lang: 'sl' | 'en'; onOpenFile: (p: string) => void; onClose: () => void; onSaved: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [supplier, setSupplier] = useState('')
  const [supplierVat, setSupplierVat] = useState('')
  const [number, setNumber] = useState('')
  const [category, setCategory] = useState<PurchaseCategory>('material')
  const [issue, setIssue] = useState('')
  const [due, setDue] = useState('')
  const [gross, setGross] = useState<number | null>(null)
  const [vat, setVat] = useState<number | null>(null)
  const [jobId, setJobId] = useState('')
  const [notes, setNotes] = useState('')
  const [paid, setPaid] = useState(false)
  const [paidAt, setPaidAt] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [keepFile, setKeepFile] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (!open) return
    setSupplier(bill?.supplier_name ?? ''); setSupplierVat(bill?.supplier_vat ?? ''); setNumber(bill?.invoice_number ?? '')
    setCategory(bill?.category ?? 'material'); setIssue(bill?.issue_date ?? todayIso()); setDue(bill?.due_date ?? '')
    setGross(bill ? Number(bill.total_gross) : null); setVat(bill?.total_vat != null ? Number(bill.total_vat) : null)
    setJobId(bill?.job_id ?? ''); setNotes(bill?.notes ?? ''); setPaid(bill?.status === 'paid'); setPaidAt(bill?.paid_at ?? '')
    setFile(null); setKeepFile(true)
  }, [open, bill])

  function pick(f: File | undefined) {
    if (!f) return
    if (f.size > 10 * 1024 * 1024) { toast.error(T.tooBig); return }
    setFile(f)
  }

  async function save() {
    if (!supplier.trim() || gross == null) { toast.error(T.needSupplier); return }
    setSaving(true)
    let file_path = bill?.file_path ?? null, file_name = bill?.file_name ?? null
    if (file) {
      const path = `${companyId}/bills/${Date.now()}-${safeFileName(file.name)}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
      if (error) { setSaving(false); toast.error(error.message); return }
      if (bill?.file_path) await supabase.storage.from(BUCKET).remove([bill.file_path])
      file_path = path; file_name = file.name
    } else if (!keepFile && bill?.file_path) {
      await supabase.storage.from(BUCKET).remove([bill.file_path])
      file_path = null; file_name = null
    }
    const row = {
      supplier_name: supplier.trim(), supplier_vat: supplierVat.trim() || null, invoice_number: number.trim() || null, category,
      issue_date: issue || null, due_date: due || null, total_gross: gross, total_vat: vat, total_net: vat != null ? Math.round((gross - vat) * 100) / 100 : null,
      job_id: jobId || null, notes: notes.trim() || null, status: (paid ? 'paid' : 'unpaid') as 'paid' | 'unpaid', paid_at: paid ? (paidAt || todayIso()) : null,
      file_path, file_name, updated_at: new Date().toISOString(),
    }
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null
    const { error } = bill
      ? await supabase.from('purchase_invoices').update(row).eq('id', bill.id)
      : await supabase.from('purchase_invoices').insert({ ...row, company_id: companyId, created_by: uid })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(T.saved); onSaved(); onClose()
  }

  async function remove() {
    if (!bill) return
    if (bill.file_path) await supabase.storage.from(BUCKET).remove([bill.file_path])
    const { error } = await supabase.from('purchase_invoices').delete().eq('id', bill.id)
    setConfirmDel(false)
    if (error) { toast.error(error.message); return }
    toast.success(T.deleted); onSaved(); onClose()
  }

  const ro = !canEdit
  const selectCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50'
  const existingFile = bill?.file_path && keepFile && !file
  const activeJobs = jobs.filter(j => j.status !== 'cancelled' || j.id === jobId)

  return (
    <>
      <Modal open={open} onClose={onClose} title={bill ? T.edit : T.add} size="lg">
        <div className="flex flex-col gap-4">
          {/* File */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{T.file}</span>
            {file || existingFile ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white border border-gray-200"><FileText className="w-4 h-4 text-blue-600" /></div>
                <span className="text-sm font-medium text-gray-900 truncate flex-1">{file?.name ?? bill?.file_name}</span>
                {existingFile && <button type="button" onClick={() => onOpenFile(bill!.file_path!)} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">{T.open}<ExternalLink className="w-3.5 h-3.5" /></button>}
                {!ro && <button type="button" onClick={() => { setFile(null); setKeepFile(false) }} className="p-1 text-gray-400 hover:text-red-600 rounded"><X className="w-4 h-4" /></button>}
              </div>
            ) : !ro && (
              <div onClick={() => fileInput.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0]) }}
                className={`flex flex-col items-center justify-center gap-1.5 px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${dragOver ? 'border-blue-500 bg-blue-50/60' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50/40'}`}>
                <UploadCloud className="w-6 h-6 text-gray-400" />
                <span className="text-sm text-gray-500 text-center">{T.drop}</span>
                <span className="text-xs text-gray-400">PDF, JPG, PNG · max 10 MB</span>
              </div>
            )}
            <input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input id="bill-supplier" label={T.supplier} value={supplier} disabled={ro} list="bill-suppliers" placeholder="npr. Jub d.o.o." onChange={e => setSupplier(e.target.value)} />
              <datalist id="bill-suppliers">{suppliers.map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <Input id="bill-number" label={T.number} value={number} disabled={ro} onChange={e => setNumber(e.target.value)} />
            <Input id="bill-vat-id" label={T.supplierVat} value={supplierVat} disabled={ro} onChange={e => setSupplierVat(e.target.value)} />
            <div className="flex flex-col gap-1">
              <label htmlFor="bill-cat" className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{T.category}</label>
              <select id="bill-cat" className={selectCls} value={category} disabled={ro} onChange={e => setCategory(e.target.value as PurchaseCategory)}>
                {PURCHASE_CATEGORIES.map(c => <option key={c} value={c}>{PURCHASE_CATEGORY_LABEL[lang][c]}</option>)}
              </select>
            </div>
            <Input id="bill-issue" type="date" label={T.issue} value={issue} disabled={ro} onChange={e => setIssue(e.target.value)} />
            <NumberInput id="bill-gross" label={T.gross} value={gross} onValue={setGross} unit="€" decimals={2} />
            <Input id="bill-due" type="date" label={T.due} value={due} min={issue || undefined} disabled={ro} onChange={e => setDue(e.target.value)} />
            <NumberInput id="bill-vat" label={T.vat} value={vat} onValue={setVat} unit="€" decimals={2} />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{T.net}</span>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 tabular-nums">
                {gross != null ? (gross - (vat ?? 0)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '—'}
              </div>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="bill-job" className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{T.job}</label>
              <select id="bill-job" className={selectCls} value={jobId} disabled={ro} onChange={e => setJobId(e.target.value)}>
                <option value="">{T.noJob}</option>
                {activeJobs.map(j => <option key={j.id} value={j.id}>{jobTitle(j)}{j.quotes?.quote_number ? ` · ${j.quotes.quote_number}` : ''}</option>)}
              </select>
              <span className="text-xs text-gray-400">{T.jobHint}</span>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="bill-notes" className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{T.notes}</label>
              <textarea id="bill-notes" rows={2} value={notes} disabled={ro} onChange={e => setNotes(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 px-3 py-2.5">
            <Checkbox checked={paid} onChange={v => { setPaid(v); if (v && !paidAt) setPaidAt(todayIso()) }} label={T.paidCheck} />
            {paid && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{T.paidDate}</span>
                <input type="date" value={paidAt} disabled={ro} onChange={e => setPaidAt(e.target.value)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-4 -mx-6 px-6 border-t border-gray-200">
            <div>{bill && isAdmin && <Button variant="danger" onClick={() => setConfirmDel(true)}>{T.del}</Button>}</div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose}>{T.cancel}</Button>
              {canEdit && <Button loading={saving} onClick={save}>{bill ? T.save : T.create}</Button>}
            </div>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={remove} title={T.delTitle} message={T.delText} confirmLabel={T.del} danger />
    </>
  )
}
