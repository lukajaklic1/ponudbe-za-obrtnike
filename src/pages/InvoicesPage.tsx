import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Plus, Receipt, Search, MoreVertical, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import Button from '../components/ui/Button'
import Pagination from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterSelect } from '../components/ui/FilterSelect'
import { DateFilter } from '../components/ui/DateFilter'
import { SortIcon } from '../components/ui/SortIcon'
import { INVOICE_STATUSES, INVOICE_STATUS_LABEL, INVOICE_STATUS_STYLE, KIND_LABEL, displayStatus, isOverdue, daysOverdue, fmtDate, todayIso } from '../lib/invoices'
import type { Invoice } from '../types/database'

interface Row extends Invoice { customers: { name: string } | null }
type SortKey = 'number' | 'customer' | 'issue' | 'due' | 'status' | 'amount'

const PAGE_SIZE = 20

const L = {
  sl: {
    title: 'Izdani računi', newInvoice: 'Nov račun', number: 'Številka', customer: 'Kupec', name: 'Naziv', issue: 'Izdan', due: 'Rok plačila', status: 'Status', amount: 'Znesek z DDV',
    kind: 'Vrsta', empty: 'Ni računov', emptyHint: 'Račun izdate iz dela v Realizaciji, iz ponudbe ali z gumbom »Nov račun«.', draft: 'Osnutek',
    open: 'Odprto', overdue: 'Zapadlo', paidMonth: 'Plačano ta mesec', drafts: 'Osnutki', from: 'Izdan od', to: 'Izdan do', days: (n: number) => `${n} d`,
  },
  en: {
    title: 'Invoices', newInvoice: 'New invoice', number: 'Number', customer: 'Customer', name: 'Title', issue: 'Issued', due: 'Due', status: 'Status', amount: 'Total incl. VAT',
    kind: 'Type', empty: 'No invoices', emptyHint: 'Issue an invoice from a job, from a quote, or with "New invoice".', draft: 'Draft',
    open: 'Open', overdue: 'Overdue', paidMonth: 'Paid this month', drafts: 'Drafts', from: 'Issued from', to: 'Issued to', days: (n: number) => `${n} d`,
  },
}

export default function InvoicesPage() {
  const { company, hasPerm, loading: permLoading } = useCompany()
  const canEdit = hasPerm('quotes', 'create')
  const { t, lang } = useLanguage()
  const T = L[lang]
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('issue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  function handleSort(k: SortKey) { setSortKey(k); setSortDir(d => k === sortKey ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); setPage(1) }

  useEffect(() => { if (company) load() }, [company])
  async function load() {
    const { data } = await supabase.from('invoices').select('*, customers(name)').eq('company_id', company!.id).order('created_at', { ascending: false })
    setRows((data as Row[]) ?? [])
    setLoading(false)
  }

  const money = (n: number) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: company?.currency ?? 'EUR' })
  const month = todayIso().slice(0, 7)
  const sum = (l: Row[]) => l.reduce((s, r) => s + Number(r.total_gross || 0), 0)
  const openRows = rows.filter(r => r.status === 'issued' || r.status === 'sent')
  const kpis = [
    { label: T.open, value: sum(openRows), count: openRows.length, color: '#215bcf', bg: '#e5eeff' },
    { label: T.overdue, value: sum(rows.filter(isOverdue)), count: rows.filter(isOverdue).length, color: '#9e3f00', bg: '#feeee1' },
    { label: T.paidMonth, value: sum(rows.filter(r => r.status === 'paid' && (r.paid_at ?? '').startsWith(month))), count: rows.filter(r => r.status === 'paid' && (r.paid_at ?? '').startsWith(month)).length, color: '#098259', bg: '#e0fced' },
    { label: T.drafts, value: sum(rows.filter(r => r.status === 'draft')), count: rows.filter(r => r.status === 'draft').length, color: '#874d00', bg: '#fff3cc' },
  ]

  const q = search.toLowerCase()
  const filtered = rows.filter(r =>
    (!statusFilter || displayStatus(r) === statusFilter || (statusFilter === 'open' && (r.status === 'issued' || r.status === 'sent'))) &&
    (!kindFilter || r.kind === kindFilter) &&
    (!dateFrom || r.issue_date >= dateFrom) && (!dateTo || r.issue_date <= dateTo) &&
    (!search || [r.invoice_number, r.title, r.customers?.name, r.reference].some(v => (v ?? '').toLowerCase().includes(q))))
  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'number') return (a.invoice_number ?? '').localeCompare(b.invoice_number ?? '', undefined, { numeric: true }) * mul
    if (sortKey === 'customer') return (a.customers?.name ?? '').localeCompare(b.customers?.name ?? '') * mul
    if (sortKey === 'due') return (a.due_date ?? '').localeCompare(b.due_date ?? '') * mul
    if (sortKey === 'status') return displayStatus(a).localeCompare(displayStatus(b)) * mul
    if (sortKey === 'amount') return (Number(a.total_gross) - Number(b.total_gross)) * mul
    return (a.issue_date.localeCompare(b.issue_date) || a.created_at.localeCompare(b.created_at)) * mul
  })
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const open = (r: Row) => navigate(r.status === 'draft' && canEdit ? `/invoices/${r.id}/edit` : `/invoices/${r.id}`)

  if (!permLoading && !hasPerm('quotes', 'view')) return <Navigate to="/dashboard" replace />

  return (
    <div>
      <PageHeader title={T.title} icon={Receipt} count={rows.length}
        action={canEdit && <Button onClick={() => navigate('/invoices/new')} className="gap-2"><Plus className="w-4 h-4" />{T.newInvoice}</Button>} />
      <div className="p-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {kpis.map(k => (
            <div key={k.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">{k.label}</span>
                <span className="px-2 py-0.5 rounded-md text-[13px] font-medium" style={{ backgroundColor: k.bg, color: k.color }}>{k.count}</span>
              </div>
              <div className="text-xl font-semibold text-gray-900 mt-1.5 tabular-nums">{money(k.value)}</div>
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
            options={[{ value: 'open', label: T.open }, { value: 'overdue', label: INVOICE_STATUS_LABEL[lang].overdue }, ...INVOICE_STATUSES.map(s => ({ value: s, label: INVOICE_STATUS_LABEL[lang][s] }))]}
            onChange={v => { setStatusFilter(v); setPage(1) }} />
          <FilterSelect label={T.kind} value={kindFilter} allLabel={t.common.all}
            options={[{ value: 'invoice', label: KIND_LABEL[lang].invoice }, { value: 'advance', label: KIND_LABEL[lang].advance }]}
            onChange={v => { setKindFilter(v); setPage(1) }} />
          <DateFilter label={T.from} value={dateFrom} allLabel={t.common.all} max={dateTo || undefined} onChange={v => { setDateFrom(v); setPage(1) }} />
          <DateFilter label={T.to} value={dateTo} allLabel={t.common.all} min={dateFrom || undefined} onChange={v => { setDateTo(v); setPage(1) }} />
        </div>

        <div className="-mx-4 border-t border-b border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-center px-4">
              <Receipt className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">{T.empty}</p>
              {rows.length === 0 && <p className="text-sm text-gray-400 mt-1 max-w-sm">{T.emptyHint}</p>}
            </div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[920px]">
              <thead className="bg-gray-50 border-b border-gray-200"><tr>
                {([['number', T.number], ['customer', T.customer], ['', T.name], ['issue', T.issue], ['due', T.due], ['status', T.status], ['amount', T.amount], ['', '']] as [SortKey | '', string][]).map(([key, h], i) => (
                  <th key={i} className={`text-left px-4 py-3 text-xs font-medium text-gray-500 ${key ? 'cursor-pointer select-none hover:text-gray-700' : ''}`} onClick={() => key && handleSort(key)}>
                    <span className="inline-flex items-center gap-0.5">{h}{key && <SortIcon active={sortKey === key} dir={sortDir} />}</span>
                  </th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-200">
                {paged.map(r => {
                  const d = displayStatus(r)
                  const st = INVOICE_STATUS_STYLE[d]
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => open(r)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#e5eeff', border: '1px solid #d6e5ff' }}>
                            <Receipt className="w-3.5 h-3.5" style={{ color: '#215bcf' }} />
                          </div>
                          <div>
                            <div className={r.invoice_number ? 'text-gray-900 font-medium' : 'text-gray-400'}>{r.invoice_number ?? T.draft}</div>
                            {r.kind === 'advance' && <div className="text-xs text-gray-400">{KIND_LABEL[lang].advance}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{r.customers?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[240px] truncate">{r.title || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-200 text-xs text-gray-900 whitespace-nowrap" style={{ backgroundColor: '#fbfbfb' }}><CalendarDays className="w-3 h-3 text-gray-500" />{fmtDate(r.issue_date)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={isOverdue(r) ? 'text-[#9e3f00] font-medium' : 'text-gray-600'}>{fmtDate(r.due_date)}</span>
                        {isOverdue(r) && <span className="ml-1.5 text-xs text-[#9e3f00]">({T.days(daysOverdue(r))})</span>}
                      </td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap" style={{ backgroundColor: st.bg, border: `1px solid ${st.border}`, color: st.color }}>{INVOICE_STATUS_LABEL[lang][d]}</span></td>
                      <td className={`px-4 py-3 whitespace-nowrap font-medium ${r.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{money(Number(r.total_gross))}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end"><button onClick={() => open(r)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><MoreVertical className="w-4 h-4" /></button></div>
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
    </div>
  )
}
