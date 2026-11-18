import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { LayoutDashboard, Search, X, CalendarDays, BarChart3, Users, Tags } from 'lucide-react'
import { SortIcon } from '../components/ui/SortIcon'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { supabase } from '../lib/supabase'
import { countQuotes } from '../utils/pluralize'
import { toast } from '../components/ui/Toast'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { FilterSelect } from '../components/ui/FilterSelect'

/** teal family for every chart */
const TEAL = { line: '#2fa596', fill: '#3fb8a8', light: '#a8ded6', faint: '#e3f4f1', grey: '#e4e4e4' }
type Q = { id: string; status: string; total_net: number; customer_id: string; assignee_id: string | null; created_at: string; sent_at: string | null; updated_at: string }

/** a KPI card like Levelpath: label, big number, change vs the previous period, a soft teal curve across the bottom */
function KpiCard({ label, value, delta, deltaLabel, series, hint }: { label: string; value: string; delta: { text: string; up: boolean | null } | null; deltaLabel: string; series: number[]; hint?: string }) {
  const data = series.map((v, i) => ({ i, v }))
  const id = 'g' + label.replace(/[^a-z]/gi, '')
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
      <div className="px-5 pt-4">
        <p className="text-[15px] font-medium text-gray-900">{label}</p>
        <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
          <p className="text-[26px] leading-8 font-bold text-gray-900 tracking-[-0.02em]">{value}</p>
          {delta && <span className="inline-flex items-center gap-1 text-xs font-semibold px-[7px] py-[3px] rounded-lg"
            style={delta.up === false ? { color: '#4a4a4a', backgroundColor: '#ececec' } : { color: '#267a47', backgroundColor: '#dbfce7' }}>
            {delta.up === null ? '' : delta.up ? '▲' : '▼'} {delta.text}</span>}
          <span className="text-[13px] font-medium text-[#4f4f4f]">{delta ? deltaLabel : hint}</span>
        </div>
      </div>
      <div className="h-[72px] mt-3 -mx-px">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TEAL.fill} stopOpacity={0.28} />
                <stop offset="100%" stopColor={TEAL.fill} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={TEAL.line} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

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

  // Current state per status (value + count) — not limited to the period; refreshed live
  type StatusKey = 'all' | 'sent' | 'won' | 'lost'
  const [statusStats, setStatusStats] = useState<Record<StatusKey, { value: number; count: number }> | null>(null)
  const [quotes, setQuotes] = useState<Q[]>([])

  // Top services: lines of non-draft quotes, filtered by the chart's own status picker (default: won)
  const [serviceLines, setServiceLines] = useState<{ name: string; value: number; status: string }[]>([])
  const [serviceStatus, setServiceStatus] = useState<'won' | 'lost' | 'sent' | 'all'>('won')
  const topServices = useMemo(() => {
    const byName = new Map<string, { name: string; value: number; count: number }>()
    for (const l of serviceLines) {
      if (serviceStatus !== 'all' && l.status !== serviceStatus) continue
      const key = l.name.toLowerCase()
      const row = byName.get(key) ?? { name: l.name, value: 0, count: 0 }
      row.value += l.value; row.count++
      byName.set(key, row)
    }
    return [...byName.values()].sort((a, b) => b.value - a.value).slice(0, 6)
  }, [serviceLines, serviceStatus])

  async function loadStatusStats() {
    if (!company) return
    const [{ data }, { data: lineData }] = await Promise.all([
      supabase.from('quotes').select('id, status, total_net, customer_id, assignee_id, created_at, sent_at, updated_at').eq('company_id', company.id),
      supabase.from('quote_lines').select('quote_id, name, total_net').eq('company_id', company.id),
    ])
    const acc: Record<StatusKey, { value: number; count: number }> = {
      all: { value: 0, count: 0 }, sent: { value: 0, count: 0 }, won: { value: 0, count: 0 }, lost: { value: 0, count: 0 },
    }
    const statusOf = new Map<string, string>()   // included quote id → status
    setQuotes(((data as Q[]) ?? []).filter(q => (!filterCustomerId || q.customer_id === filterCustomerId) && (!assigneeFilter || q.assignee_id === assigneeFilter)))
    for (const q of (data as Q[]) ?? []) {
      if (filterCustomerId && q.customer_id !== filterCustomerId) continue
      if (assigneeFilter && q.assignee_id !== assigneeFilter) continue
      if (q.status === 'draft') continue          // drafts are work in progress, not offers
      statusOf.set(q.id, q.status)
      const v = Number(q.total_net) || 0
      acc.all.value += v; acc.all.count++
      const key = q.status === 'issued' ? 'sent' : q.status   // older quotes: Izdano counts as Poslano
      if (key in acc) { acc[key as StatusKey].value += v; acc[key as StatusKey].count++ }
    }
    setStatusStats(acc)

    setServiceLines(((lineData as { quote_id: string; name: string; total_net: number }[]) ?? [])
      .filter(l => statusOf.has(l.quote_id))
      .map(l => ({ name: l.name.trim(), value: Number(l.total_net) || 0, status: statusOf.get(l.quote_id) === 'issued' ? 'sent' : statusOf.get(l.quote_id)! })))
  }

  useEffect(() => { if (company) loadStatusStats() }, [company, filterCustomerId, assigneeFilter])

  // Live: refresh when any quote of this company changes (other users too) and when the tab regains focus
  useEffect(() => {
    if (!company) return
    const refresh = () => { loadStatusStats(); load() }
    const onFocus = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    const sb = supabase as any
    const channel = typeof sb.channel === 'function'
      ? sb.channel(`dashboard-quotes-${company.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes', filter: `company_id=eq.${company.id}` }, refresh)
          .subscribe()
      : null
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
      if (channel) sb.removeChannel(channel)
    }
  }, [company, filterCustomerId, assigneeFilter, period])

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



  const formatPeriod = (date: string) => {
    if (!date.includes('-')) return date
    const parts = date.split('-')
    const [y, m, d] = parts
    return parts.length === 3 ? `${d}.${m}.${y.slice(2)}` : `${m}/${y.slice(2)}`
  }

  const sl = lang === 'sl'

  const st = statusStats
  // the chosen period and the one before it, split into buckets for the curves (days, weeks or months)
  const kpi = (() => {
    const DAY = 86400000
    const now = Date.now(), len = period * 30 * DAY
    const start = now - len, prevStart = start - len
    const buckets = period === 1 ? 30 : period === 12 ? 12 : period * 13 / 3 | 0
    const bucketOf = (t: number) => Math.min(buckets - 1, Math.max(0, Math.floor((t - start) / (len / buckets))))
    const inCur = (d: string | null) => !!d && +new Date(d) >= start && +new Date(d) <= now
    const inPrev = (d: string | null) => !!d && +new Date(d) >= prevStart && +new Date(d) < start
    const sentAt = (q: Q) => q.status === 'draft' ? null : q.sent_at ?? q.created_at
    const closedAt = (q: Q) => (q.status === 'won' || q.status === 'lost' ? q.updated_at : null)
    const series = (pick: (q: Q) => string | null, val: (q: Q) => number, filter: (q: Q) => boolean = () => true) => {
      const out = Array(buckets).fill(0)
      for (const q of quotes) { const d = pick(q); if (filter(q) && inCur(d)) out[bucketOf(+new Date(d!))] += val(q) }
      // running total through the period: a smooth rising curve instead of single spikes
      let run = 0
      return out.map(x => (run += x))
    }
    const sum = (inP: (d: string | null) => boolean, pick: (q: Q) => string | null, val: (q: Q) => number, filter: (q: Q) => boolean = () => true) =>
      quotes.reduce((a, q) => a + (filter(q) && inP(pick(q)) ? val(q) : 0), 0)
    const v = (q: Q) => Number(q.total_net) || 0, one = () => 1
    const won = (q: Q) => q.status === 'won', lost = (q: Q) => q.status === 'lost'
    const change = (cur: number, prev: number, fmt: (n: number) => string, asPct = true) => {
      if (!cur && !prev) return null
      if (!prev) return { text: fmt(cur), up: cur > 0 ? true : null }
      const d = asPct ? Math.round(((cur - prev) / prev) * 100) : cur - prev
      return { text: asPct ? `${Math.abs(d)} %` : fmt(Math.abs(d)), up: d === 0 ? null : d > 0 }
    }
    const sentV = sum(inCur, sentAt, v), sentVp = sum(inPrev, sentAt, v)
    const sentN = sum(inCur, sentAt, one), sentNp = sum(inPrev, sentAt, one)
    const wonV = sum(inCur, closedAt, v, won), wonVp = sum(inPrev, closedAt, v, won)
    const wonN = sum(inCur, closedAt, one, won), lostN = sum(inCur, closedAt, one, lost)
    const wonNp = sum(inPrev, closedAt, one, won), lostNp = sum(inPrev, closedAt, one, lost)
    const rate = wonN + lostN ? Math.round(wonN / (wonN + lostN) * 100) : 0
    const rateP = wonNp + lostNp ? Math.round(wonNp / (wonNp + lostNp) * 100) : 0
    const wonS = series(closedAt, one, won), lostS = series(closedAt, one, lost)
    let w = 0, l = 0
    const rateS = wonS.map((x, i) => { w += x; l += lostS[i]; return w + l ? w / (w + l) * 100 : 0 })
    return [
      { label: sl ? 'Poslane ponudbe' : 'Quotes sent', value: String(sentN), delta: change(sentN, sentNp, n => String(n), false), series: series(sentAt, one) },
      { label: sl ? 'Vrednost poslanih ponudb' : 'Value of quotes sent', value: money(sentV), delta: change(sentV, sentVp, money), series: series(sentAt, v) },
      { label: sl ? 'Dobljeni posli' : 'Deals won', value: money(wonV), delta: change(wonV, wonVp, money), series: series(closedAt, v, won) },
      { label: sl ? 'Uspešnost' : 'Win rate', value: `${rate} %`, delta: wonN + lostN || wonNp + lostNp ? { text: `${Math.abs(rate - rateP)} ${sl ? 'o. t.' : 'pts'}`, up: rate === rateP ? null : rate > rateP } : null, series: rateS },
    ]
  })()

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
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  )

  return (
    <div>
      <PageHeader title={t.nav.dashboard} icon={LayoutDashboard} />

      {/* Subtitle + filter bar */}
      <div className="px-6 pt-5 flex flex-wrap items-center gap-3">
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
              className="h-8 pl-9 pr-8 border border-gray-200 rounded-[10px] text-sm bg-white text-gray-900 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 transition-colors"
            />
            {(searchText || filterCustomerId) && (
              <button onClick={() => { setSearchText(''); setFilterCustomerId(null); setShowDropdown(false); setCurrentPage(1) }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto min-w-[200px]">
                <div className="px-3 py-2 text-sm text-gray-600 hover:bg-[#fafafa] cursor-pointer"
                  onClick={() => { setFilterCustomerId(null); setSearchText(''); setShowDropdown(false); setCurrentPage(1) }}>
                  {sl ? 'Vse stranke' : 'All customers'}
                </div>
                {customers.filter(c => c.customer_name.toLowerCase().includes(searchText.toLowerCase())).map(c => (
                  <div key={c.customer_id}
                    className={`px-3 py-2 text-sm cursor-pointer border-t border-gray-100 hover:bg-[#fafafa] ${filterCustomerId === c.customer_id ? 'text-gray-900 font-medium' : 'text-gray-700'}`}
                    onClick={() => { setFilterCustomerId(c.customer_id); setSearchText(c.customer_name); setShowDropdown(false); setCurrentPage(1) }}>
                    {c.customer_name}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="px-6 py-5 space-y-6">

        {/* KPI cards: number, change vs the previous period, teal curve (Levelpath style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpi.map(k => <KpiCard key={k.label} label={k.label} value={k.value} delta={k.delta} series={k.series}
            deltaLabel={sl ? 'glede na prejšnje obdobje' : 'vs previous period'} hint={sl ? 'v izbranem obdobju' : 'in this period'} />)}
        </div>


        {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Values chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-[15px] font-semibold text-gray-900 mb-5">{sl ? 'Vrednost ponudb' : 'Quote value'}</h2>
              {!hasValues ? emptyChart : <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trends} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="won-realized_value" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TEAL.fill} stopOpacity={0.3} /><stop offset="100%" stopColor={TEAL.fill} stopOpacity={0.02} /></linearGradient>
                    <linearGradient id="sent-sent_value" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TEAL.light} stopOpacity={0.35} /><stop offset="100%" stopColor={TEAL.light} stopOpacity={0.02} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="period" tickFormatter={formatPeriod} tick={{ fontSize: 13, fill: '#4f4f4f', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => moneyK(v)} width={64} tick={{ fontSize: 13, fill: '#4f4f4f', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => money(v as number)} contentStyle={{ borderRadius: 10, border: '1px solid #dfdfdf', fontSize: 13, fontWeight: 500 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, fontWeight: 500, color: '#4f4f4f', paddingTop: 8 }} />
                  <Area type="monotone" dataKey="sent_value" name={sl ? 'Poslano' : 'Sent'} stroke={TEAL.light} strokeWidth={2} fill="url(#sent-sent_value)" />
                  <Area type="monotone" dataKey="realized_value" name={sl ? 'Dobljeno' : 'Won'} stroke={TEAL.line} strokeWidth={2} fill="url(#won-realized_value)" />
                </AreaChart>
              </ResponsiveContainer>}
            </div>

            {/* Count chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-[15px] font-semibold text-gray-900 mb-5">{sl ? 'Število ponudb' : 'Quote count'}</h2>
              {!hasCounts ? emptyChart : <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trends} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="won-realized_count" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TEAL.fill} stopOpacity={0.3} /><stop offset="100%" stopColor={TEAL.fill} stopOpacity={0.02} /></linearGradient>
                    <linearGradient id="sent-sent_count" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TEAL.light} stopOpacity={0.35} /><stop offset="100%" stopColor={TEAL.light} stopOpacity={0.02} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="period" tickFormatter={formatPeriod} tick={{ fontSize: 13, fill: '#4f4f4f', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} width={36} tick={{ fontSize: 13, fill: '#4f4f4f', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #dfdfdf', fontSize: 13, fontWeight: 500 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, fontWeight: 500, color: '#4f4f4f', paddingTop: 8 }} />
                  <Area type="monotone" dataKey="sent_count" name={sl ? 'Poslane' : 'Sent'} stroke={TEAL.light} strokeWidth={2} fill="url(#sent-sent_count)" />
                  <Area type="monotone" dataKey="realized_count" name={sl ? 'Dobljene' : 'Won'} stroke={TEAL.line} strokeWidth={2} fill="url(#won-realized_count)" />
                </AreaChart>
              </ResponsiveContainer>}
            </div>
          </div>


        {/* Status breakdown (donut) + top services */}
        {(() => {
          const slices = [
            { key: 'sent', name: sl ? 'Poslane' : 'Sent', color: TEAL.light },
            { key: 'won', name: sl ? 'Dobljene' : 'Won', color: TEAL.line },
            { key: 'lost', name: sl ? 'Izgubljene' : 'Lost', color: TEAL.grey },
          ].map(x => ({ ...x, count: st?.[x.key as StatusKey].count ?? 0, value: st?.[x.key as StatusKey].value ?? 0 }))
          const total = st?.all.count ?? 0
          const servicesTotal = topServices.reduce((a, x) => a + x.value, 0)
          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-[15px] font-semibold text-gray-900 mb-4">{sl ? 'Ponudbe po statusu' : 'Quotes by status'}</h2>
                {total === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[220px] text-center">
                    <BarChart3 className="w-10 h-10 text-gray-200 mb-3" />
                    <p className="text-sm text-gray-400">{sl ? 'Še ni poslanih ponudb.' : 'No sent quotes yet.'}</p>
                  </div>
                ) : (<>
                  <div className="flex items-center gap-6 h-[240px]">
                  <div className="relative w-[220px] h-[220px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={slices.filter(x => x.count > 0)} dataKey="count" nameKey="name" innerRadius={74} outerRadius={104} paddingAngle={2} stroke="none">
                          {slices.filter(x => x.count > 0).map(x => <Cell key={x.key} fill={x.color} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [countQuotes(lang, Number(v)), n]} contentStyle={{ borderRadius: 8, border: '1px solid #dfdfdf', fontSize: 13 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[26px] font-bold tracking-[-0.02em] text-gray-900">{total}</span>
                      <span className="text-[13px] font-medium text-[#4f4f4f]">{countQuotes(lang, total).replace(/^\d+ /, '')}</span>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    {slices.map(x => (
                      <div key={x.key} className="flex items-center gap-2 text-sm font-medium">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: x.color }} />
                        <span className="text-[#4f4f4f] flex-1">{x.name}</span>
                        <span className="text-gray-900 font-medium tabular-nums">{x.count}</span>
                      </div>
                    ))}
                  </div>
                  </div>
                </>)}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
                <div className="flex items-center justify-between gap-3 mb-5 -mt-1">
                  <h2 className="text-[15px] font-semibold text-gray-900">
                    {sl ? 'Storitve po vrednosti' : 'Services by value'}
                  </h2>
                  <FilterSelect label={sl ? 'Status ponudb' : 'Quote status'} value={serviceStatus === 'all' ? '' : serviceStatus} allLabel={sl ? 'Vse' : 'All'}
                    options={[
                      { value: 'won', label: sl ? 'Dobljene' : 'Won' },
                      { value: 'lost', label: sl ? 'Izgubljene' : 'Lost' },
                      { value: 'sent', label: sl ? 'Poslane' : 'Sent' },
                    ]}
                    onChange={v => setServiceStatus((v || 'all') as typeof serviceStatus)} />
                </div>
                {topServices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[260px] text-center">
                    <Tags className="w-10 h-10 text-gray-200 mb-3" />
                    <p className="text-sm text-gray-400">{sl ? 'Še ni podatkov o storitvah.' : 'No service data yet.'}</p>
                  </div>
                ) : (
                  /* Same look as the other charts: dashed grid, grey axis labels, blue rounded bars, shared tooltip */
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={topServices} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={8}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ececec" horizontal={false} />
                      <XAxis type="number" tickFormatter={v => moneyK(v)} tick={{ fontSize: 12, fill: '#4f4f4f' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={210} tick={{ fontSize: 12, fill: '#4f4f4f' }} axisLine={false} tickLine={false}
                        tickFormatter={(n: string) => n.length > 26 ? n.slice(0, 25) + '…' : n} />
                      <Tooltip formatter={(v) => [`${money(v as number)} (${servicesTotal ? Math.round(((v as number) / servicesTotal) * 100) : 0} %)`, sl ? 'Vrednost' : 'Value']}
                        cursor={{ fill: '#f6f6f6' }} contentStyle={{ borderRadius: 8, border: '1px solid #dfdfdf', fontSize: 13 }} />
                      <Bar dataKey="value" fill={TEAL.fill} radius={[0, 6, 6, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )
        })()}

        {/* Customer table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-[15px] font-semibold text-gray-900">{s.topCustomers}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-medium min-w-[600px]">
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
                        className={`px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap cursor-pointer select-none hover:text-gray-700 text-${col.align}`}
                        onClick={() => handleSort(col.key)}>
                        <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                          {col.label}
                          <SortIcon active={sortKey === col.key} dir={sortDir} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedCustomers.length === 0 && (
                    <tr><td colSpan={6}>
                      <div className="flex flex-col items-center justify-center h-48 text-center">
                        <Users className="w-10 h-10 text-gray-200 mb-3" />
                        <p className="text-sm text-gray-400">{sl ? 'Ni še podatkov o strankah.' : 'No customer data yet.'}</p>
                      </div>
                    </td></tr>
                  )}
                  {paginatedCustomers.map(c => (
                    <tr key={c.customer_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{c.customer_name}</td>
                      <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{money(c.sent_value)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{money(c.realized_value)}</td>
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">{c.sent_count}</td>
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">{c.realized_count}</td>
                      <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{c.win_rate.toFixed(1)} %</td>
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
