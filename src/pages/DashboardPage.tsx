import { useEffect, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { LayoutDashboard, TrendingUp, Trophy, FileText, CheckCircle2, Search, X, CalendarDays, BarChart3, Users } from 'lucide-react'
import { SortIcon } from '../components/ui/SortIcon'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { FilterSelect } from '../components/ui/FilterSelect'

interface Stats {
  pipeline_value: number
  win_rate: number
  won_90d: number
  lost_90d: number
  active_quotes: number
  realized_this_month: number
}

interface TrendData {
  period: string
  sent_count: number
  sent_value: number
  realized_count: number
  realized_value: number
}

interface CustomerStat {
  customer_id: string
  customer_name: string
  sent_value: number
  realized_value: number
  sent_count: number
  realized_count: number
  win_rate: number
}

type SortKey = 'customer_name' | 'sent_value' | 'realized_value' | 'sent_count' | 'realized_count' | 'win_rate'
type SortDir = 'asc' | 'desc'

export default function DashboardPage() {
  const { company } = useCompany()
  const { t, lang } = useLanguage()
  const s = t.qp
  const cur = company?.currency ?? 'EUR'
  const money = (n: number) => (n ?? 0).toLocaleString('de-DE', { style: 'currency', currency: cur, maximumFractionDigits: 0 })
  const moneyK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k €` : `${n.toFixed(0)} €`

  const [stats, setStats] = useState<Stats | null>(null)
  const [trends, setTrends] = useState<TrendData[]>([])
  const [customers, setCustomers] = useState<CustomerStat[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<1 | 3 | 6 | 12>(3)
  const [sortKey, setSortKey] = useState<SortKey>('sent_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterCustomerId, setFilterCustomerId] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string>('')
  const [companyUsers, setCompanyUsers] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [searchText, setSearchText] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    if (company) {
      load()
      supabase.from('users').select('id, first_name, last_name').eq('company_id', company.id).eq('is_active', true).order('first_name')
        .then(({ data }) => { if (data) setCompanyUsers(data) })
    }
  }, [company, period, filterCustomerId, assigneeFilter])

  async function load() {
    if (!company) return
    // spinner only on first load (initial state) — reloads keep the current view on screen
    const [{ data: st, error: e1 }, { data: tr, error: e2 }, { data: cu, error: e3 }] = await Promise.all([
      (supabase as any).rpc('get_quote_dashboard_stats', { p_company_id: company.id, p_customer_id: filterCustomerId, p_assignee_id: assigneeFilter || null }),
      (supabase as any).rpc('get_quote_trends', { p_company_id: company.id, p_months: period, p_customer_id: filterCustomerId, p_assignee_id: assigneeFilter || null }),
      (supabase as any).rpc('get_customer_stats', { p_company_id: company.id, p_assignee_id: assigneeFilter || null }),
    ])
    // Never leave the page spinning: show what loaded, surface the first error
    const err = e1 ?? e2 ?? e3
    if (err) { console.error('dashboard', err); toast.error(err.message) }
    setStats((st as Stats) ?? { pipeline_value: 0, win_rate: 0, won_90d: 0, lost_90d: 0, active_quotes: 0, realized_this_month: 0 })
    setTrends(((tr as TrendData[]) || []).sort((a, b) => a.period.localeCompare(b.period)))
    setCustomers((cu as CustomerStat[]) || [])
    setLoading(false)
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sortedCustomers = [...customers].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    const mul = sortDir === 'asc' ? 1 : -1
    return typeof av === 'string' ? av.localeCompare(bv as string) * mul : ((av as number) - (bv as number)) * mul
  })
  const filteredCustomers = filterCustomerId ? sortedCustomers.filter(c => c.customer_id === filterCustomerId) : sortedCustomers
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize))
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const totalSentValue = trends.reduce((s, t) => s + (t.sent_value || 0), 0)
  const totalRealizedValue = trends.reduce((s, t) => s + (t.realized_value || 0), 0)
  const totalSentCount = trends.reduce((s, t) => s + (t.sent_count || 0), 0)
  const totalRealizedCount = trends.reduce((s, t) => s + (t.realized_count || 0), 0)


  const formatPeriod = (date: string) => {
    if (!date.includes('-')) return date
    const parts = date.split('-')
    const [y, m, d] = parts
    return parts.length === 3 ? `${d}.${m}.${y.slice(2)}` : `${m}/${y.slice(2)}`
  }

  const sl = lang === 'sl'

  const kpis = [
    { label: sl ? 'Vrednost poslanih' : 'Sent value', value: money(totalSentValue), icon: TrendingUp, bg: 'bg-blue-50', iconColor: 'text-blue-500' },
    { label: sl ? 'Vrednost dobljenih' : 'Won value', value: money(totalRealizedValue), icon: CheckCircle2, bg: 'bg-[#e0fced]', iconColor: 'text-[#007d53]' },
    { label: sl ? 'Poslane ponudbe' : 'Sent quotes', value: String(totalSentCount), icon: FileText, bg: 'bg-blue-50', iconColor: 'text-blue-400' },
    { label: sl ? 'Dobljene ponudbe' : 'Won quotes', value: String(totalRealizedCount), icon: Trophy, bg: 'bg-[#e0fced]', iconColor: 'text-[#007d53]' },
  ]

  const periods = [
    { v: 1 as const, sl: '30 dni', en: '30 days' },
    { v: 3 as const, sl: '3 mesece', en: '3 months' },
    { v: 6 as const, sl: '6 mesecev', en: '6 months' },
    { v: 12 as const, sl: '12 mesecev', en: '12 months' },
  ]

  const hasValues = trends.some(t => (t.sent_value || 0) > 0 || (t.realized_value || 0) > 0)
  const hasCounts = trends.some(t => (t.sent_count || 0) > 0 || (t.realized_count || 0) > 0)
  // Same look as the other empty states in the app: light icon + short grey sentence
  const emptyChart = (
    <div className="flex flex-col items-center justify-center h-[260px] text-center">
      <BarChart3 className="w-10 h-10 text-gray-200 mb-3" />
      <p className="text-sm text-gray-400">{sl ? 'Za izbrano obdobje še ni podatkov.' : 'No data for the selected period yet.'}</p>
    </div>
  )

  if (loading || !stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div>
      <PageHeader title={t.nav.dashboard} icon={LayoutDashboard} />

      {/* Subtitle + filter bar */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <p className="text-lg font-semibold text-gray-900">{sl ? 'Analitika' : 'Analytics'}</p>
          <span className="text-sm text-gray-500">{sl ? 'Pregled in analiza vaših ponudb' : 'Overview and analysis of your quotes'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">

          {/* Period dropdown */}
          <FilterSelect
            label={sl ? 'Obdobje' : 'Period'}
            value={String(period)}
            allLabel=""
            options={periods.map(p => ({ value: String(p.v), label: sl ? p.sl : p.en }))}
            onChange={v => { if (v) setPeriod(Number(v) as 1 | 3 | 6 | 12) }}
            icon={CalendarDays}
          />


          {/* Assignee filter */}
          {companyUsers.length > 0 && (
            <FilterSelect
              label={sl ? 'Odgovorna oseba' : 'Assignee'}
              value={assigneeFilter}
              allLabel={sl ? 'Vse' : 'All'}
              options={companyUsers.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))}
              onChange={v => { setAssigneeFilter(v); setCurrentPage(1) }}
            />
          )}

          {/* Customer dropdown */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={sl ? 'Stranka: Vse' : 'Customer: All'}
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              className="pl-9 pr-8 py-1 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 transition-colors"
            />
            {(searchText || filterCustomerId) && (
              <button onClick={() => { setSearchText(''); setFilterCustomerId(null); setShowDropdown(false); setCurrentPage(1) }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto min-w-[200px]">
                <div className="px-3 py-2 text-sm text-gray-600 hover:bg-[#fbfbfb] cursor-pointer"
                  onClick={() => { setFilterCustomerId(null); setSearchText(''); setShowDropdown(false); setCurrentPage(1) }}>
                  {sl ? 'Vse stranke' : 'All customers'}
                </div>
                {customers.filter(c => c.customer_name.toLowerCase().includes(searchText.toLowerCase())).map(c => (
                  <div key={c.customer_id}
                    className={`px-3 py-2 text-sm cursor-pointer border-t border-gray-100 hover:bg-[#fbfbfb] ${filterCustomerId === c.customer_id ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                    onClick={() => { setFilterCustomerId(c.customer_id); setSearchText(c.customer_name); setShowDropdown(false); setCurrentPage(1) }}>
                    {c.customer_name}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="p-4 space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${k.bg}`}>
                <k.icon className={`w-4 h-4 ${k.iconColor}`} />
              </div>
              <p className="text-xs font-medium text-label">{k.label}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-0.5 tracking-tight">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Values chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-900 mb-5">{sl ? 'Vrednost ponudb' : 'Quote value'}</h2>
              {!hasValues ? emptyChart : <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trends} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="period" tickFormatter={formatPeriod} tick={{ fontSize: 12, fill: '#5e5e5e' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => moneyK(v)} tick={{ fontSize: 12, fill: '#5e5e5e' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip formatter={(v) => money(v as number)} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#6b7280', paddingTop: 8 }} />
                  <Bar dataKey="sent_value" name={sl ? 'Poslano' : 'Sent'} fill="#bfdbfe" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="realized_value" name={sl ? 'Dobljeno' : 'Won'} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>}
            </div>

            {/* Count chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-900 mb-5">{sl ? 'Število ponudb' : 'Quote count'}</h2>
              {!hasCounts ? emptyChart : <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trends} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="period" tickFormatter={formatPeriod} tick={{ fontSize: 12, fill: '#5e5e5e' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#5e5e5e' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#6b7280', paddingTop: 8 }} />
                  <Bar dataKey="sent_count" name={sl ? 'Poslane' : 'Sent'} fill="#bbf7d0" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="realized_count" name={sl ? 'Dobljene' : 'Won'} fill="#00d17e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>}
            </div>
          </div>


        {/* Customer table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-sm font-medium text-gray-900">{s.topCustomers}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {[
                      { key: 'customer_name' as SortKey, label: sl ? 'Stranka' : 'Customer', align: 'left' },
                      { key: 'sent_value' as SortKey, label: sl ? 'Poslana vrednost' : 'Sent value', align: 'right' },
                      { key: 'realized_value' as SortKey, label: sl ? 'Dobljena vrednost' : 'Won value', align: 'right' },
                      { key: 'sent_count' as SortKey, label: sl ? 'Poslane' : 'Sent', align: 'center' },
                      { key: 'realized_count' as SortKey, label: sl ? 'Dobljene' : 'Won', align: 'center' },
                      { key: 'win_rate' as SortKey, label: sl ? 'Uspešnost' : 'Win rate', align: 'right' },
                    ].map(col => (
                      <th key={col.key}
                        className={`px-6 py-3 text-xs font-medium text-gray-500 cursor-pointer select-none text-${col.align}`}
                        onClick={() => handleSort(col.key)}>
                        <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                          {col.label}
                          <SortIcon active={sortKey === col.key} dir={sortDir} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedCustomers.length === 0 && (
                    <tr><td colSpan={6}>
                      <div className="flex flex-col items-center justify-center h-48 text-center">
                        <Users className="w-10 h-10 text-gray-200 mb-3" />
                        <p className="text-sm text-gray-400">{sl ? 'Ni še podatkov o strankah.' : 'No customer data yet.'}</p>
                      </div>
                    </td></tr>
                  )}
                  {paginatedCustomers.map(c => (
                    <tr key={c.customer_id} className="hover:bg-[#fbfbfb]">
                      <td className="px-6 py-3 font-medium text-gray-900">{c.customer_name}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{money(c.sent_value)}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{money(c.realized_value)}</td>
                      <td className="px-6 py-3 text-center text-gray-600">{c.sent_count}</td>
                      <td className="px-6 py-3 text-center text-gray-600">{c.realized_count}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{c.win_rate.toFixed(1)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {sl ? `Stran ${currentPage} od ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="px-3 py-1 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-[#f6f6f6] disabled:opacity-40 disabled:cursor-not-allowed">
                    {sl ? 'Prejšnja' : 'Previous'}
                  </button>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-[#f6f6f6] disabled:opacity-40 disabled:cursor-not-allowed">
                    {sl ? 'Naslednja' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </div>

      </div>
    </div>
  )
}
