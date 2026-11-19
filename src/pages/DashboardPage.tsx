import { useEffect, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { LayoutDashboard, Search, X, BarChart3, Tags } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, LabelList, Rectangle } from 'recharts'
import { supabase } from '../lib/supabase'
import { countQuotes } from '../utils/pluralize'
import { toast } from '../components/ui/Toast'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { FilterSelect } from '../components/ui/FilterSelect'
import { DateRangeFilter } from '../components/ui/DateRangeFilter'
import { SortIcon } from '../components/ui/SortIcon'
import Pagination from '../components/ui/Pagination'
import { leadSourceLabel, leadSourceOptions, LEAD_SOURCES } from '../lib/leadSources'

/** legend in the same order as the bars (the chart library sorts by name otherwise) */
const LEGEND_ORDER = ['sent_value', 'won_value', 'sent_count', 'won_count', 'won', 'rest']
/** teal family for every chart */
const TEAL = { line: '#2fa596', fill: '#3fb8a8', light: '#a8ded6', faint: '#e3f4f1', grey: '#e4e4e4' }
type Q = { id: string; status: string; total_net: number; customer_id: string; assignee_id: string | null; created_at: string; sent_at: string | null; updated_at: string; closed_at?: string | null; source?: string | null; lead_source?: string | null }

/** a value card like Levelpath: label, big number, a badge with the number of quotes (status colours), share of the total */
const TONES = { grey: { color: '#4a4a4a', backgroundColor: '#ececec' }, yellow: { color: '#8a6100', backgroundColor: '#fef3cd' }, green: { color: '#267a47', backgroundColor: '#dbfce7' } }
function StatCard({ label, value, badge, tone }: { label: string; value: string; badge: string; tone: keyof typeof TONES; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
      <p className="text-[15px] font-medium text-gray-900 truncate" title={label}>{label}</p>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap xl:flex-nowrap">
        <p className="text-[24px] leading-8 font-bold text-gray-900 tracking-[-0.02em] whitespace-nowrap">{value}</p>
        <span className="inline-flex text-xs font-semibold px-[7px] py-[3px] rounded-lg whitespace-nowrap" style={TONES[tone]}>{badge}</span>
      </div>
    </div>
  )
}

/** a ring card like "Ponudbe po statusu": ring with the total value, legend under it with count and value */
function RingCard({ title, parts, money, lang, empty }: { empty?: string; title: string; parts: { key: string; name: string; color: string; count: number; value: number }[]; money: (n: number) => string; lang: 'sl' | 'en' }) {
  const shown = parts.filter(p => p.value > 0)
  const total = parts.reduce((a, p) => a + p.value, 0)
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex-1 flex flex-col">
      <h2 className="text-[15px] font-semibold text-gray-900 mb-4">{title}</h2>
      {total === 0 ? <div className="flex-1 flex items-center justify-center min-h-[220px] px-6 text-center text-sm text-gray-400">{empty ?? (lang === 'sl' ? 'V izbranem obdobju še ni ponudb.' : 'No quotes in this period yet.')}</div> :
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-[200px] h-[200px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie isAnimationActive={false} data={shown} dataKey="value" nameKey="name" innerRadius={66} outerRadius={94} paddingAngle={2} stroke="none">
                {shown.map(p => <Cell key={p.key} fill={p.color} />)}
              </Pie>
              <Tooltip wrapperStyle={{ zIndex: 20 }} formatter={(v, n) => [money(Number(v)), n]} contentStyle={{ borderRadius: 10, border: '1px solid #dfdfdf', fontSize: 13, fontWeight: 500 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[20px] font-bold tracking-[-0.02em] text-gray-900">{money(total)}</span>
          </div>
        </div>
        <div className="w-full flex flex-col gap-2">
          {parts.filter(p => p.count > 0).sort((x, y) => y.value - x.value).map(p => (
            <div key={p.key} className="flex items-center gap-2 text-sm font-medium">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-[#4f4f4f] flex-1 min-w-0 truncate" title={p.name}>{p.name}</span>
              <span className="text-[#4f4f4f] tabular-nums">{p.count}</span>
              <span className="text-gray-900 tabular-nums w-[92px] text-right">{money(p.value)}</span>
            </div>
          ))}
        </div>
      </div>}
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

interface CustomerStat {
  customer_id: string
  customer_name: string
  sent_value: number
  realized_value: number
  sent_count: number
  realized_count: number
  win_rate: number
}

export default function DashboardPage() {
  const { company } = useCompany()
  const { t, lang } = useLanguage()
  const cur = company?.currency ?? 'EUR'
  const money = (n: number) => (n ?? 0).toLocaleString('de-DE', { style: 'currency', currency: cur, maximumFractionDigits: 0 })
  // short value on top of a bar: 4,0k (one line even on a narrow bar)
  const kShort = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : String(Math.round(n)))
  const moneyK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k €` : `${n.toFixed(0)} €`

  const [stats, setStats] = useState<Stats | null>(null)
  const [customers, setCustomers] = useState<CustomerStat[]>([])
  const [loading, setLoading] = useState(true)
  // filters: date range (default last 90 days), status, where the quote came from, customer type
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10) })
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  // customers table: sorting and pages
  const [cSort, setCSort] = useState<{ key: 'name' | 'count' | 'value' | 'won' | 'rate'; dir: 'asc' | 'desc' }>({ key: 'value', dir: 'desc' })
  const [cPage, setCPage] = useState(1)
  const cPageSize = 20
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({})
  const [customerTypes, setCustomerTypes] = useState<Record<string, string>>({})
  const [filterCustomerId, setFilterCustomerId] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string>('')
  const [companyUsers, setCompanyUsers] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [searchText, setSearchText] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  // Current state per status (value + count) — not limited to the period; refreshed live
  type StatusKey = 'all' | 'sent' | 'won' | 'lost'
  const [, setStatusStats] = useState<Record<StatusKey, { value: number; count: number }> | null>(null)
  const [quotes, setQuotes] = useState<Q[]>([])

  // lines of all quotes (the services chart picks those of the period)
  const [serviceLines, setServiceLines] = useState<{ quote_id: string; name: string; value: number }[]>([])

  async function loadStatusStats() {
    if (!company) return
    const [{ data }, { data: lineData }] = await Promise.all([
      supabase.from('quotes').select('id, status, total_net, customer_id, assignee_id, created_at, sent_at, updated_at, closed_at, source, lead_source').eq('company_id', company.id),
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
      .map(l => ({ quote_id: l.quote_id, name: l.name.trim(), value: Number(l.total_net) || 0 })))
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
  }, [company, filterCustomerId, assigneeFilter])

  useEffect(() => {
    if (company) {
      load()
      supabase.from('customers').select('id, name, customer_type').eq('company_id', company.id)
        .then(({ data }) => { setCustomerNames(Object.fromEntries(((data as { id: string; name: string }[]) ?? []).map(c => [c.id, c.name]))); return { data } })
        .then(({ data }) => setCustomerTypes(Object.fromEntries(((data as { id: string; customer_type: string | null }[]) ?? []).map(c => [c.id, c.customer_type ?? 'person']))))
      supabase.from('users').select('id, first_name, last_name').eq('company_id', company.id).eq('is_active', true).order('first_name')
        .then(({ data }) => { if (data) setCompanyUsers(data) })
    }
  }, [company, filterCustomerId, assigneeFilter])

  async function load() {
    if (!company) return
    // spinner only on first load (initial state) — reloads keep the current view on screen
    // (the monthly charts are computed from the quotes on this page)
    const [{ data: st, error: e1 }, { data: cu, error: e3 }] = await Promise.all([
      (supabase as any).rpc('get_quote_dashboard_stats', { p_company_id: company.id, p_customer_id: filterCustomerId, p_assignee_id: assigneeFilter || null }),
      (supabase as any).rpc('get_customer_stats', { p_company_id: company.id, p_assignee_id: assigneeFilter || null }),
    ])
    // Never leave the page spinning: show what loaded, surface the first error
    const err = e1 ?? e3
    if (err) { console.error('dashboard', err); toast.error(err.message) }
    setStats((st as Stats) ?? { pipeline_value: 0, win_rate: 0, won_90d: 0, lost_90d: 0, active_quotes: 0, realized_this_month: 0 })
    setCustomers((cu as CustomerStat[]) || [])
    setLoading(false)
  }




  const formatPeriod = (date: string) => {
    if (!date.includes('-')) return date
    const parts = date.split('-')
    const [y, m, d] = parts
    return parts.length === 3 ? `${d}.${m}.${y.slice(2)}` : `${m}/${y.slice(2)}`
  }

  const sl = lang === 'sl'

  // every filter except the dates (customer and assignee are applied when loading)
  const statusKey = (q: Q) => (q.status === 'issued' ? 'sent' : q.status)
  const base = quotes.filter(q => (!statusFilter || statusKey(q) === statusFilter)
    && (!sourceFilter || (sourceFilter === 'configurator' ? q.source === 'configurator' : q.source !== 'configurator'))
    && (!typeFilter || (customerTypes[q.customer_id] ?? 'person') === typeFilter)
    && (!channelFilter || (q.lead_source ?? 'none') === channelFilter))
  const fromT = dateFrom ? +new Date(dateFrom + 'T00:00:00') : -Infinity
  const toT = dateTo ? +new Date(dateTo + 'T23:59:59') : Infinity
  const inRange = (d: string | null | undefined) => !!d && +new Date(d) >= fromT && +new Date(d) <= toT
  // quotes made in the chosen dates
  const inPeriod = base.filter(q => inRange(q.created_at))

  // quotes made in the chosen dates, by their status now: the five values add up to the total
  const cards = (() => {
    const sum = (f: (q: Q) => boolean) => inPeriod.filter(f).reduce((acc, q) => ({ value: acc.value + (Number(q.total_net) || 0), count: acc.count + 1 }), { value: 0, count: 0 })
    const all = sum(() => true)
    const share = (v: number) => (all.value ? `${Math.round(v / all.value * 100)}% ${sl ? 'vrednosti' : 'of the value'}` : '')
    const row = (label: string, x: { value: number; count: number }, tone: 'grey' | 'yellow' | 'green', sub: string) => ({ label, value: money(x.value), badge: countQuotes(lang, x.count), tone, sub })
    const draft = sum(q => q.status === 'draft'), sent = sum(q => q.status === 'sent' || q.status === 'issued'), won = sum(q => q.status === 'won'), lost = sum(q => q.status === 'lost')
    return [
      row(sl ? 'Skupna vrednost ponudb' : 'Total value of quotes', all, 'grey', all.value ? share(all.value) : ''),
      row(sl ? 'Osnutki' : 'Drafts', draft, 'grey', share(draft.value)),
      row(sl ? 'Poslane' : 'Sent', sent, 'grey', share(sent.value)),
      row(sl ? 'Dobljene' : 'Won', won, 'grey', share(won.value)),
      row(sl ? 'Izgubljene' : 'Lost', lost, 'grey', share(lost.value)),
    ]
  })()


  // months of the chosen dates: sent in the month it was sent, won in the month it was won
  const months = (() => {
    const first = dateFrom ? new Date(dateFrom) : new Date(Math.min(Date.now(), ...base.map(q => +new Date(q.created_at))))
    const last = dateTo ? new Date(dateTo) : new Date()
    const keys: string[] = []
    for (let d = new Date(first.getFullYear(), first.getMonth(), 1); d <= last && keys.length < 24; d = new Date(d.getFullYear(), d.getMonth() + 1, 1))
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    if (!keys.length) keys.push(`${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`)
    const rows = keys.map(k => ({ period: k, sent_value: 0, won_value: 0, sent_count: 0, won_count: 0 }))
    const at = (d: string | null | undefined) => (d && inRange(d) ? rows.find(r => r.period === d.slice(0, 7)) : undefined)
    for (const q of base) {
      if (q.status === 'draft') continue
      const v = Number(q.total_net) || 0
      const sentRow = at(q.sent_at ?? q.created_at)
      if (sentRow) { sentRow.sent_value += v; sentRow.sent_count++ }
      // won in the month it was won
      if (q.status === 'won') { const w = at(q.closed_at ?? q.updated_at); if (w) { w.won_value += v; w.won_count++ } }
    }
    return rows
  })()
  const hasValues = months.some(t => t.sent_value > 0 || t.won_value > 0)
  const hasCounts = months.some(t => t.sent_count > 0 || t.won_count > 0)
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

          {/* dates from – to, with quick choices */}
          <DateRangeFilter label={sl ? 'Obdobje' : 'Period'} from={dateFrom} to={dateTo} onChange={(fr, to) => { setDateFrom(fr); setDateTo(to) }} />

          <FilterSelect label={sl ? 'Status' : 'Status'} value={statusFilter} allLabel={sl ? 'Vsi' : 'All'} onChange={setStatusFilter}
            options={[{ value: 'draft', label: sl ? 'Osnutki' : 'Drafts' }, { value: 'sent', label: sl ? 'Poslane' : 'Sent' }, { value: 'won', label: sl ? 'Dobljene' : 'Won' }, { value: 'lost', label: sl ? 'Izgubljene' : 'Lost' }]} />

          <FilterSelect label={sl ? 'Vir' : 'Source'} value={sourceFilter} allLabel={sl ? 'Vsi' : 'All'} onChange={setSourceFilter}
            options={[{ value: 'configurator', label: sl ? 'Spletni konfigurator' : 'Online configurator' }, { value: 'app', label: sl ? 'Narejene v aplikaciji' : 'Made in the app' }]} />

          <FilterSelect label={sl ? 'Prodajni kanal' : 'Sales channel'} value={channelFilter} allLabel={sl ? 'Vsi' : 'All'} onChange={setChannelFilter}
            options={leadSourceOptions(sl ? 'sl' : 'en')} />

          <FilterSelect label={sl ? 'Tip stranke' : 'Customer type'} value={typeFilter} allLabel={sl ? 'Vsi' : 'All'} onChange={setTypeFilter}
            options={[{ value: 'person', label: sl ? 'Fizične osebe' : 'Private persons' }, { value: 'company', label: sl ? 'Podjetja' : 'Companies' }]} />


          {/* Assignee filter */}
          {companyUsers.length > 0 && (
            <FilterSelect
              label={sl ? 'Odgovorna oseba' : 'Assignee'}
              value={assigneeFilter}
              allLabel={sl ? 'Vse' : 'All'}
              options={companyUsers.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))}
              onChange={v => { setAssigneeFilter(v) }}
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
              className="h-8 pl-9 pr-8 border border-gray-200 rounded-[10px] text-sm bg-white text-gray-900 shadow-[0_1px_2px_rgba(16,24,40,0.06)] hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 transition-colors"
            />
            {(searchText || filterCustomerId) && (
              <button onClick={() => { setSearchText(''); setFilterCustomerId(null); setShowDropdown(false) }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto min-w-[200px]">
                <div className="px-3 py-2 text-sm text-gray-600 hover:bg-[#fafafa] cursor-pointer"
                  onClick={() => { setFilterCustomerId(null); setSearchText(''); setShowDropdown(false) }}>
                  {sl ? 'Vse stranke' : 'All customers'}
                </div>
                {customers.filter(c => c.customer_name.toLowerCase().includes(searchText.toLowerCase())).map(c => (
                  <div key={c.customer_id}
                    className={`px-3 py-2 text-sm cursor-pointer border-t border-gray-100 hover:bg-[#fafafa] ${filterCustomerId === c.customer_id ? 'text-gray-900 font-medium' : 'text-gray-700'}`}
                    onClick={() => { setFilterCustomerId(c.customer_id); setSearchText(c.customer_name); setShowDropdown(false) }}>
                    {c.customer_name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {(statusFilter || sourceFilter || typeFilter || channelFilter || assigneeFilter || filterCustomerId || dateTo) && (
            <button type="button" onClick={() => { setStatusFilter(''); setSourceFilter(''); setTypeFilter(''); setChannelFilter(''); setAssigneeFilter(''); setFilterCustomerId(null); setSearchText(''); setDateTo(''); const d = new Date(); d.setDate(d.getDate() - 90); setDateFrom(d.toISOString().slice(0, 10)) }}
              className="h-8 px-2.5 rounded-[10px] text-sm font-medium text-[#4f4f4f] hover:text-gray-900 hover:bg-gray-100 transition-colors">{sl ? 'Počisti filtre' : 'Clear filters'}</button>
          )}
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">

        {/* five value cards: total, then drafts / sent / won / lost of the quotes made in the period */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {cards.map(c => <StatCard key={c.label} {...c} />)}
        </div>


        {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Values chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-[15px] font-semibold text-gray-900 mb-4">{sl ? 'Vrednost ponudb po času' : 'Quote value over time'}</h2>
              {!hasValues ? emptyChart : <ResponsiveContainer width="100%" height={260}>
                <BarChart data={months} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barGap={4} barCategoryGap="24%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ececec" vertical={false} />
                  <XAxis dataKey="period" tickFormatter={formatPeriod} tick={{ fontSize: 13, fill: '#4f4f4f', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => moneyK(v)} width={64} tick={{ fontSize: 13, fill: '#4f4f4f', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f6f6f6' }} formatter={(v) => money(v as number)} labelFormatter={l => formatPeriod(String(l))} contentStyle={{ borderRadius: 10, border: '1px solid #dfdfdf', fontSize: 13, fontWeight: 500 }} />
                  <Legend iconType="square" iconSize={8} itemSorter={(it: any) => LEGEND_ORDER.indexOf(it.dataKey)} wrapperStyle={{ fontSize: 13, fontWeight: 500, color: '#4f4f4f', paddingTop: 8 }} />
                  <Bar isAnimationActive={false} dataKey="sent_value" name={sl ? 'Poslano' : 'Sent'} fill={TEAL.light} radius={[6, 6, 0, 0]} maxBarSize={40}><LabelList position="top" formatter={(v: unknown) => (Number(v) ? kShort(Number(v)) : '')} style={{ fontSize: 11, fontWeight: 400, fill: '#4f4f4f' }} /></Bar>
                  <Bar isAnimationActive={false} dataKey="won_value" name={sl ? 'Dobljeno' : 'Won'} fill={TEAL.line} radius={[6, 6, 0, 0]} maxBarSize={40}><LabelList position="top" formatter={(v: unknown) => (Number(v) ? kShort(Number(v)) : '')} style={{ fontSize: 11, fontWeight: 400, fill: '#4f4f4f' }} /></Bar>
                </BarChart>
              </ResponsiveContainer>}
            </div>

            {/* Count chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-[15px] font-semibold text-gray-900 mb-4">{sl ? 'Število ponudb po času' : 'Quotes over time'}</h2>
              {!hasCounts ? emptyChart : <ResponsiveContainer width="100%" height={260}>
                <BarChart data={months} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barGap={4} barCategoryGap="24%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ececec" vertical={false} />
                  <XAxis dataKey="period" tickFormatter={formatPeriod} tick={{ fontSize: 13, fill: '#4f4f4f', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} width={36} tick={{ fontSize: 13, fill: '#4f4f4f', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f6f6f6' }} labelFormatter={l => formatPeriod(String(l))} contentStyle={{ borderRadius: 10, border: '1px solid #dfdfdf', fontSize: 13, fontWeight: 500 }} />
                  <Legend iconType="square" iconSize={8} itemSorter={(it: any) => LEGEND_ORDER.indexOf(it.dataKey)} wrapperStyle={{ fontSize: 13, fontWeight: 500, color: '#4f4f4f', paddingTop: 8 }} />
                  <Bar isAnimationActive={false} dataKey="sent_count" name={sl ? 'Poslane' : 'Sent'} fill={TEAL.light} radius={[6, 6, 0, 0]} maxBarSize={40}><LabelList position="top" formatter={(v: unknown) => (Number(v) ? String(v) : '')} style={{ fontSize: 11, fontWeight: 400, fill: '#4f4f4f' }} /></Bar>
                  <Bar isAnimationActive={false} dataKey="won_count" name={sl ? 'Dobljene' : 'Won'} fill={TEAL.line} radius={[6, 6, 0, 0]} maxBarSize={40}><LabelList position="top" formatter={(v: unknown) => (Number(v) ? String(v) : '')} style={{ fontSize: 11, fontWeight: 400, fill: '#4f4f4f' }} /></Bar>
                </BarChart>
              </ResponsiveContainer>}
            </div>
          </div>


        {/* Status breakdown (donut) + top services — the quotes made in the period, like the cards */}
        {(() => {
          const slices = [
            { key: 'draft', name: sl ? 'Osnutki' : 'Drafts', color: '#c9c9c9' },
            { key: 'sent', name: sl ? 'Poslane' : 'Sent', color: TEAL.light },
            { key: 'won', name: sl ? 'Dobljene' : 'Won', color: TEAL.line },
            { key: 'lost', name: sl ? 'Izgubljene' : 'Lost', color: TEAL.grey },
          ].map(x => ({ ...x, count: inPeriod.filter(q => statusKey(q) === x.key).length }))
          const total = inPeriod.length
          // every service of the sent quotes: all of it (light) with the won part (dark) in one bar
          const statusOfQ = new Map(inPeriod.filter(q => q.status !== 'draft').map(q => [q.id, q.status]))
          const byName = new Map<string, { name: string; total: number; won: number }>()
          for (const l of serviceLines) {
            const stq = statusOfQ.get(l.quote_id)
            if (!stq || !l.name) continue
            const row = byName.get(l.name.toLowerCase()) ?? { name: l.name, total: 0, won: 0 }
            row.total += l.value; if (stq === 'won') row.won += l.value
            byName.set(l.name.toLowerCase(), row)
          }
          const topServices = [...byName.values()].sort((a, b) => b.total - a.total).slice(0, 6)
            .map(x => ({ ...x, rest: Math.max(0, x.total - x.won), label: `${moneyK(x.total)} · ${x.total ? Math.round(x.won / x.total * 100) : 0}% ${sl ? 'dobljeno' : 'won'}` }))
          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-[15px] font-semibold text-gray-900 mb-4">{sl ? 'Ponudbe po statusu' : 'Quotes by status'}</h2>
                {total === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[220px] text-center">
                    <BarChart3 className="w-10 h-10 text-gray-200 mb-3" />
                    <p className="text-sm text-gray-400">{sl ? 'V izbranem obdobju še ni ponudb.' : 'No quotes in this period yet.'}</p>
                  </div>
                ) : (<>
                  <div className="flex flex-col items-center gap-4">
                  <div className="relative w-[200px] h-[200px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie isAnimationActive={false} data={slices.filter(x => x.count > 0)} dataKey="count" nameKey="name" innerRadius={66} outerRadius={94} paddingAngle={2} stroke="none">
                          {slices.filter(x => x.count > 0).map(x => <Cell key={x.key} fill={x.color} />)}
                        </Pie>
                        <Tooltip wrapperStyle={{ zIndex: 20 }} formatter={(v, n) => [countQuotes(lang, Number(v)), n]} contentStyle={{ borderRadius: 8, border: '1px solid #dfdfdf', fontSize: 13 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[26px] font-bold tracking-[-0.02em] text-gray-900">{total}</span>
                      <span className="text-[13px] font-medium text-[#4f4f4f]">{countQuotes(lang, total).replace(/^\d+ /, '')}</span>
                    </div>
                  </div>
                  <div className="w-full flex flex-col gap-2">
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
                </div>
                {topServices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[260px] text-center">
                    <Tags className="w-10 h-10 text-gray-200 mb-3" />
                    <p className="text-sm text-gray-400">{sl ? 'Še ni podatkov o storitvah.' : 'No service data yet.'}</p>
                  </div>
                ) : (
                  /* Same look as the other charts: dashed grid, grey axis labels, blue rounded bars, shared tooltip */
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topServices} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap={10}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ececec" horizontal={false} />
                      <XAxis type="number" tickFormatter={v => moneyK(v)} tick={{ fontSize: 12, fill: '#4f4f4f', fontWeight: 500 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={210} tick={{ fontSize: 13, fill: '#4f4f4f', fontWeight: 500 }} axisLine={false} tickLine={false}
                        tickFormatter={(n: string) => n.length > 26 ? n.slice(0, 25) + '…' : n} />
                      <Tooltip cursor={{ fill: '#f6f6f6' }} formatter={(v, n, item) => [money(Number((item as { dataKey?: string }).dataKey === 'rest' ? (item as { payload: { total: number } }).payload.total : v)), n]} contentStyle={{ borderRadius: 10, border: '1px solid #dfdfdf', fontSize: 13, fontWeight: 500 }} />
                      <Legend iconType="square" iconSize={8} itemSorter={(it: any) => LEGEND_ORDER.indexOf(it.dataKey)} wrapperStyle={{ fontSize: 13, fontWeight: 500, color: '#4f4f4f', paddingTop: 8 }} />
                      <Bar isAnimationActive={false} dataKey="won" stackId="s" name={sl ? 'Dobljeno' : 'Won'} fill={TEAL.line} maxBarSize={22}
                        // fully won (nothing light after it): the dark part gets the rounded end
                        shape={(p: any) => <Rectangle {...p} radius={p.payload?.rest > 0 ? 0 : [0, 6, 6, 0]} />}>
                        <LabelList position="inside" formatter={(v: unknown) => (Number(v) ? kShort(Number(v)) : '')} style={{ fontSize: 11, fontWeight: 400, fill: '#ffffff' }} />
                      </Bar>
                      <Bar isAnimationActive={false} dataKey="rest" stackId="s" name={sl ? 'Ponujeno' : 'Offered'} fill={TEAL.light} radius={[0, 6, 6, 0]} maxBarSize={22}>
                        <LabelList dataKey="total" position="right" formatter={(v: unknown) => (Number(v) ? kShort(Number(v)) : '')} style={{ fontSize: 11, fontWeight: 400, fill: '#4f4f4f' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )
        })()}

        {/* customers, sales channel and source of the quotes made in the period */}
        {(() => {
          const val = (q: Q) => Number(q.total_net) || 0
          const byCustomer = new Map<string, { id: string; name: string; count: number; value: number; won: number }>()
          for (const q of inPeriod) {
            const r = byCustomer.get(q.customer_id) ?? { id: q.customer_id, name: customerNames[q.customer_id] ?? '—', count: 0, value: 0, won: 0 }
            r.count++; r.value += val(q); if (q.status === 'won') r.won += val(q)
            byCustomer.set(q.customer_id, r)
          }
          const rate = (c: { value: number; won: number }) => (c.value ? c.won / c.value : 0)
          const sorted = [...byCustomer.values()].sort((a, b) => {
            const m = cSort.dir === 'asc' ? 1 : -1
            if (cSort.key === 'name') return a.name.localeCompare(b.name) * m
            const va = cSort.key === 'rate' ? rate(a) : a[cSort.key], vb = cSort.key === 'rate' ? rate(b) : b[cSort.key]
            return (va - vb) * m
          })
          const top = sorted.slice((cPage - 1) * cPageSize, cPage * cPageSize)
          const th = (key: typeof cSort.key, label: string, right = true) => (
            <th className={`${right ? 'text-right' : 'text-left'} px-4 cursor-pointer select-none hover:text-gray-900`}
              onClick={() => { setCSort(s0 => ({ key, dir: s0.key === key && s0.dir === 'desc' ? 'asc' : 'desc' })); setCPage(1) }}>
              <span className="inline-flex items-center gap-0.5">{label}<SortIcon active={cSort.key === key} dir={cSort.dir} /></span>
            </th>
          )
          const CH_COLORS = ['#2fa596', '#4fb8a9', '#7ccabe', '#a8ded6', '#cdeee9', '#7d7d7d', '#b5b5b5', '#dcdcdc']
          // every quote has a channel; older ones without it are left out here
          const channels = LEAD_SOURCES.map((k, i) => ({ key: k as string, color: CH_COLORS[i] }))
            .map(c => { const qs = inPeriod.filter(q => (q.lead_source ?? 'none') === c.key); return { ...c, name: leadSourceLabel(c.key === 'none' ? null : c.key, sl ? 'sl' : 'en'), count: qs.length, value: qs.reduce((a, q) => a + val(q), 0) } })
          const sources = [
            { key: 'app', name: sl ? 'Interna priprava ponudb' : 'Made in the app', color: TEAL.light, f: (q: Q) => q.source !== 'configurator' },
            { key: 'configurator', name: sl ? 'Spletni konfigurator' : 'Online configurator', color: TEAL.line, f: (q: Q) => q.source === 'configurator' },
          ].map(x => { const qs = inPeriod.filter(x.f); return { key: x.key, name: x.name, color: x.color, count: qs.length, value: qs.reduce((a, q) => a + val(q), 0) } })
          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 flex flex-col">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 lg:min-h-[1015px]">
                <h2 className="text-[15px] font-semibold text-gray-900 px-6 pt-6 pb-4">{sl ? 'Stranke' : 'Customers'}</h2>
                {top.length === 0 ? <div className="flex items-center justify-center h-[220px] text-sm text-gray-400">{sl ? 'V izbranem obdobju še ni ponudb.' : 'No quotes in this period yet.'}</div> :
                <table className="w-full table-fixed">
                  <colgroup><col /><col className="w-[110px]" /><col className="w-[130px]" /><col className="w-[130px]" /><col className="w-[120px]" /></colgroup>
                  <thead><tr>
                    {th('name', sl ? 'Stranka' : 'Customer', false)}
                    {th('count', sl ? 'Ponudbe' : 'Quotes')}
                    {th('value', sl ? 'Vrednost' : 'Value')}
                    {th('won', sl ? 'Dobljeno' : 'Won')}
                    {th('rate', sl ? 'Uspešnost' : 'Win rate')}
                  </tr></thead>
                  <tbody>
                    {top.map(c => <tr key={c.id}>
                      <td className="px-4"><div className="truncate" title={c.name}>{c.name}</div></td>
                      <td className="px-4 text-right whitespace-nowrap text-[#4f4f4f]">{c.count}</td>
                      <td className="px-4 text-right whitespace-nowrap">{money(c.value)}</td>
                      <td className="px-4 text-right whitespace-nowrap">{c.won ? money(c.won) : '—'}</td>
                      <td className="px-4 text-right whitespace-nowrap text-[#4f4f4f]">{c.value ? `${Math.round(c.won / c.value * 100)}%` : '—'}</td>
                    </tr>)}
                  </tbody>
                </table>}
              </div>
              <Pagination total={sorted.length} page={cPage} pageSize={cPageSize} onChange={setCPage} fixedSize />
              </div>
              {/* sales channel and where the quotes came from, two rings one under the other */}
              <div className="flex flex-col gap-4 h-full">
                <RingCard title={sl ? 'Prodajni kanal' : 'Sales channel'} parts={channels} money={money} lang={sl ? 'sl' : 'en'}
                  empty={inPeriod.length ? (sl ? 'Ponudbe v tem obdobju še nimajo prodajnega kanala. Izberite ga pri urejanju ponudbe, nove ga imajo vedno.' : 'Quotes in this period have no sales channel yet. Set it when editing a quote; new ones always have it.') : undefined} />
                <RingCard title={sl ? 'Vir ponudb' : 'Quote source'} parts={sources} money={money} lang={sl ? 'sl' : 'en'} />
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
