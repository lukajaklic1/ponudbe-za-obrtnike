import { useEffect, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { LayoutDashboard, Search, X, Send, Trophy, XCircle, Percent } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts'
import { supabase } from '../lib/supabase'
import { countQuotes, countOpen } from '../utils/pluralize'
import { toast } from '../components/ui/Toast'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { FilterSelect } from '../components/ui/FilterSelect'
import { cn } from '../lib/cn'
import { DateRangeFilter } from '../components/ui/DateRangeFilter'
import { SortIcon } from '../components/ui/SortIcon'
import Pagination from '../components/ui/Pagination'
import { isDraftLike } from '../lib/quoteStatus'
import { CATEGORIES, categoryLabel, categoryOfLine } from '../lib/quoteCategories'
import { leadSourceLabel, leadSourceOptions, LEAD_SOURCES } from '../lib/leadSources'

/** legend in the same order as the bars (the chart library sorts by name otherwise) */
const LEGEND_ORDER = ['sent_value', 'won_value', 'sent_count', 'won_count', 'won', 'rest']
/** The page alternates: quote value and the status ring in blue, quote count and the category bars in green,
 *  then the sales channel ring in blue and the source ring in green again. */
const BLUE = { light: '#bfdbfe', mid: '#93c5fd', dark: '#3b82f6', faint: '#dbeafe' }
const GREEN = { light: '#bbf7d0', dark: '#00d17e' }
type Q = { id: string; status: string; total_net: number; customer_id: string; assignee_id: string | null; created_at: string; sent_at: string | null; updated_at: string; closed_at?: string | null; source?: string | null; lead_source?: string | null }

/** a value card like Levelpath: label, big number, a badge with the number of quotes (status colours), share of the total */
const BLUE_CHIP = { bg: '#e5eeff', color: '#215bcf' }
const GREEN_CHIP = { bg: '#dbfce7', color: '#267a47' }
const GREY_CHIP = { bg: '#f4f4f5', color: '#5e5e5e' }
/** One of the four numbers the page is read for: grey by default, blue for what is still in play, green for won. */
function StatCard({ icon: Icon, label, value, sub, delta, tone = 'grey' }:
  { icon: typeof Send; label: string; value: string; sub: string; delta?: string; tone?: 'grey' | 'blue' | 'green' }) {
  const k = tone === 'green' ? GREEN_CHIP : tone === 'blue' ? BLUE_CHIP : GREY_CHIP
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: k.bg }}>
        <Icon className="w-4 h-4" style={{ color: k.color }} />
      </div>
      <p className="text-xs font-medium text-label truncate" title={label}>{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-0.5 tracking-tight whitespace-nowrap">{value}</p>
      <p className="text-xs text-[#7f7f7f] mt-1 truncate" title={sub}>{sub}</p>
      {delta && <p className="text-xs text-[#7f7f7f] mt-0.5 truncate" title={delta}>{delta}</p>}
    </div>
  )
}

/** One row of a breakdown card: the name and a line of context on the left, a bar across the middle,
 *  the number and its sub-line on the right. The category and the channel card are both built from it. */
function BreakdownRow({ name, caption, value, sub, segments }: {
  name: string; caption: string; value: string; sub: string
  /** widths in per cent of the track, drawn left to right */
  segments: { w: number; color: string }[]
}) {
  return (
    <div className="py-4 flex items-center gap-4 sm:gap-6">
      <div className="w-[120px] sm:w-[200px] shrink-0 min-w-0 text-left">
        <p className="text-sm font-medium text-gray-900 truncate" title={name}>{name}</p>
        <p className="text-xs text-[#7f7f7f] mt-0.5 truncate">{caption}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="h-3.5 rounded-full bg-[#f4f4f5] overflow-hidden flex">
          {segments.filter(x => x.w > 0).map((x, k) => (
            <div key={k} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${Math.max(x.w, 1)}%`, backgroundColor: x.color }} />
          ))}
        </div>
      </div>
      <div className="w-[88px] sm:w-[120px] shrink-0 text-right">
        <p className="text-base font-semibold tabular-nums text-gray-900">{value}</p>
        <p className="text-xs text-[#7f7f7f] tabular-nums truncate">{sub}</p>
      </div>
    </div>
  )
}

/** Title, one line of explanation, then the rows. */
function BreakdownCard({ title, hint, empty, children, legend }: {
  title: string; hint: string; empty: string; legend?: { name: string; color: string }[]; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-[#7f7f7f] mt-1">{hint}</p>
        </div>
        {legend && <div className="flex items-center gap-3 shrink-0 pt-0.5">
          {legend.map(l => <span key={l.name} className="flex items-center gap-1.5 text-xs text-[#5e5e5e]">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />{l.name}</span>)}
        </div>}
      </div>
      {children
        ? <div className="divide-y divide-gray-100 mt-1">{children}</div>
        : <div className="h-24 flex items-center justify-center text-sm font-medium text-gray-400">{empty}</div>}
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
  // the time chart is read either in euros or in the number of quotes
  const [timeMetric, setTimeMetric] = useState<'value' | 'count'>('value')
  const [dateFrom, setDateFrom] = useState('')   // no period by default: everything
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  // customers table: sorting and pages
  const [cSort, setCSort] = useState<{ key: 'name' | 'count' | 'value' | 'won' | 'rate'; dir: 'asc' | 'desc' }>({ key: 'value', dir: 'desc' })
  const [cPage, setCPage] = useState(1)
  const cPageSize = 12
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
  const [serviceLines, setServiceLines] = useState<{ quote_id: string; name: string; value: number; cat: string }[]>([])
  // the category of what the quotes contain (windows, doors, roof windows …); a click on a bar filters by it
  const [categoryFilter, setCategoryFilter] = useState('')

  async function loadStatusStats() {
    if (!company) return
    const [{ data }, { data: lineData }, { data: optData }] = await Promise.all([
      supabase.from('quotes').select('id, status, total_net, customer_id, assignee_id, created_at, sent_at, updated_at, closed_at, source, lead_source').eq('company_id', company.id),
      supabase.from('quote_lines').select('quote_id, name, total_net, config').eq('company_id', company.id),
      supabase.from('window_options').select('name, group_key').eq('company_id', company.id).in('group_key', ['installation', 'removal', 'finishing', 'transport']),
    ])
    const acc: Record<StatusKey, { value: number; count: number }> = {
      all: { value: 0, count: 0 }, sent: { value: 0, count: 0 }, won: { value: 0, count: 0 }, lost: { value: 0, count: 0 },
    }
    const statusOf = new Map<string, string>()   // included quote id → status
    setQuotes(((data as Q[]) ?? []).filter(q => (!filterCustomerId || q.customer_id === filterCustomerId) && (!assigneeFilter || q.assignee_id === assigneeFilter)))
    for (const q of (data as Q[]) ?? []) {
      if (filterCustomerId && q.customer_id !== filterCustomerId) continue
      if (assigneeFilter && q.assignee_id !== assigneeFilter) continue
      if (isDraftLike(q.status)) continue          // drafts and enquiries are work in progress, not offers
      statusOf.set(q.id, q.status)
      const v = Number(q.total_net) || 0
      acc.all.value += v; acc.all.count++
      const key = q.status === 'issued' || q.status === 'downloaded' || q.status === 'measure' ? 'sent' : q.status   // Izdano and a downloaded offer count as Poslano in the charts
      if (key in acc) { acc[key as StatusKey].value += v; acc[key as StatusKey].count++ }
    }
    setStatusStats(acc)

    // services of an enquiry from the customer's configurator are lines without a configuration: recognised by the name of the service
    const svcNames = new Set(((optData as { name: string }[] | null) ?? []).map(o => (o.name ?? '').trim().toLowerCase()))
    setServiceLines(((lineData as { quote_id: string; name: string; total_net: number; config: unknown }[]) ?? [])
      .map(l => ({ quote_id: l.quote_id, name: (l.name ?? '').trim(), value: Number(l.total_net) || 0, cat: categoryOfLine(l.config, l.name, svcNames) })))
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
    // a day or a week bucket inside a chosen period needs no year
    return parts.length === 3 ? `${Number(d)}. ${Number(m)}.` : `${m}/${y.slice(2)}`
  }

  const sl = lang === 'sl'

  // every filter except the dates (customer and assignee are applied when loading)
  const statusKey = (q: Q) => isDraftLike(q.status) ? 'draft' : q.status === 'downloaded' || q.status === 'measure' ? 'sent' : q.status
  const quoteCats = new Map<string, Set<string>>()
  for (const l of serviceLines) { const set = quoteCats.get(l.quote_id) ?? new Set<string>(); set.add(l.cat); quoteCats.set(l.quote_id, set) }
  const base = quotes.filter(q => (!statusFilter || statusKey(q) === statusFilter)
    && (!categoryFilter || quoteCats.get(q.id)?.has(categoryFilter))
    && (!sourceFilter || (sourceFilter === 'configurator' ? q.source === 'configurator' : q.source !== 'configurator'))
    && (!typeFilter || (customerTypes[q.customer_id] ?? 'person') === typeFilter)
    && (!channelFilter || (q.lead_source ?? 'none') === channelFilter))
  const fromT = dateFrom ? +new Date(dateFrom + 'T00:00:00') : -Infinity
  const toT = dateTo ? +new Date(dateTo + 'T23:59:59') : Infinity
  const inRange = (d: string | null | undefined) => !!d && +new Date(d) >= fromT && +new Date(d) <= toT
  // quotes made in the chosen dates
  const inPeriod = base.filter(q => inRange(q.created_at))

  // the four numbers the page is read for, for any set of quotes
  const figures = (qs: Q[]) => {
    const sum = (f: (q: Q) => boolean) => qs.filter(f).reduce((a, q) => ({ value: a.value + (Number(q.total_net) || 0), count: a.count + 1 }), { value: 0, count: 0 })
    // open = everything still undecided: povpraševanje, osnutek, izdano, poslano, preneseno, izmera
    const open = sum(q => q.status !== 'won' && q.status !== 'lost')
    const won = sum(q => q.status === 'won')
    const lost = sum(q => q.status === 'lost')
    const decided = won.value + lost.value, decidedN = won.count + lost.count
    return { open, won, lost, decidedN,
      rate: decided ? Math.round(won.value / decided * 100) : null,
      rateN: decidedN ? Math.round(won.count / decidedN * 100) : null }
  }
  const kpi = figures(inPeriod)

  // the same length of time right before the chosen period; with no period chosen there is nothing to compare to
  const before = (() => {
    if (!dateFrom) return null
    const from = +new Date(dateFrom + 'T00:00:00')
    const to = dateTo ? +new Date(dateTo + 'T23:59:59') : Date.now()
    const len = to - from
    const qs = base.filter(q => { const t = +new Date(q.created_at); return t >= from - len - 1 && t < from })
    return figures(qs)
  })()
  /** "↑ 18 % proti prejšnjemu obdobju"; pp = the difference in percentage points, for the win rate */
  const vsBefore = (now: number | null, then: number | null | undefined, pp = false) => {
    if (!before || then == null || now == null) return ''
    if (!then) return now ? (sl ? 'prej brez' : 'none before') : ''
    const d = pp ? Math.round(now - then) : Math.round((now - then) / then * 100)
    if (!d) return sl ? 'enako kot prej' : 'same as before'
    return `${d > 0 ? '↑' : '↓'} ${Math.abs(d)}${pp ? (sl ? ' o. t.' : ' pp') : ' %'} ${sl ? 'proti prejšnjemu obdobju' : 'vs the period before'}`
  }

  // the whole funnel in one strip under the cards: a status per column, count over value
  const funnel = [
    { key: 'enquiry', label: sl ? 'Povpraševanja' : 'Enquiries' },
    { key: 'draft', label: sl ? 'Osnutki ponudb' : 'Draft quotes' },
    { key: 'issued', label: sl ? 'Izdane ponudbe' : 'Issued quotes' },
    { key: 'sent', label: sl ? 'Poslane ponudbe' : 'Sent quotes' },
    { key: 'downloaded', label: sl ? 'Prenesene ponudbe' : 'Downloaded quotes' },
    { key: 'measure', label: sl ? 'Izmere' : 'Measurements' },
    { key: 'won', label: sl ? 'Dobljene ponudbe' : 'Won quotes' },
    { key: 'lost', label: sl ? 'Izgubljene ponudbe' : 'Lost quotes' },
  ].map(x => {
    const xs = inPeriod.filter(q => q.status === x.key)
    return { ...x, count: xs.length, value: xs.reduce((a, q) => a + (Number(q.total_net) || 0), 0) }
  })

  // The chart follows the chosen period: a bar per day for up to a month, per week for up to half a year,
  // per month beyond that. A quote counts as sent in the bucket it was sent in, as won in the one it was won in.
  const months = (() => {
    const first = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date(Math.min(Date.now(), ...base.map(q => +new Date(q.created_at))))
    const last = dateTo ? new Date(dateTo + 'T23:59:59') : new Date()
    const days = Math.max(1, Math.round((+last - +first) / 86400000) + 1)
    const unit: 'day' | 'week' | 'month' = days <= 31 ? 'day' : days <= 182 ? 'week' : 'month'
    const pad = (n: number) => String(n).padStart(2, '0')
    const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const monday = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
    const keyOf = (d: Date) => unit === 'month' ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}` : dayKey(unit === 'week' ? monday(d) : d)
    const step = (d: Date) => unit === 'month' ? new Date(d.getFullYear(), d.getMonth() + 1, 1)
      : new Date(d.getFullYear(), d.getMonth(), d.getDate() + (unit === 'week' ? 7 : 1))
    const start = unit === 'month' ? new Date(first.getFullYear(), first.getMonth(), 1)
      : unit === 'week' ? monday(first) : new Date(first.getFullYear(), first.getMonth(), first.getDate())
    const keys: string[] = []
    for (let d = start; d <= last && keys.length < 40; d = step(d)) keys.push(keyOf(d))
    if (!keys.length) keys.push(keyOf(last))
    const rows = keys.map(k => ({ period: k, sent_value: 0, won_value: 0, sent_count: 0, won_count: 0 }))
    const at = (d: string | null | undefined) => (d && inRange(d) ? rows.find(r => r.period === keyOf(new Date(d))) : undefined)
    for (const q of base) {
      if (isDraftLike(q.status)) continue
      const v = Number(q.total_net) || 0
      const sentRow = at(q.sent_at ?? q.created_at)
      if (sentRow) { sentRow.sent_value += v; sentRow.sent_count++ }
      if (q.status === 'won') { const w = at(q.closed_at ?? q.updated_at); if (w) { w.won_value += v; w.won_count++ } }
    }
    return rows
  })()
  /** too many bars to write a number over each one */
  const dense = months.length > 12
  const hasValues = months.some(t => t.sent_value > 0 || t.won_value > 0)
  const hasCounts = months.some(t => t.sent_count > 0 || t.won_count > 0)
  const GHOST = [0.45, 0.7, 0.55, 0.85, 0.6, 0.75, 0.5, 0.9, 0.65, 0.8, 0.4, 0.7]
  const ghostMonths = months.map((m, i) => ({ ...m, sent_value: GHOST[i % 12] * 3000, won_value: GHOST[(i + 5) % 12] * 1600, sent_count: GHOST[i % 12] * 3, won_count: GHOST[(i + 5) % 12] * 1.6 }))
  const GREY = { light: '#eeeff1', dark: '#d4d4d8' }
  // Same look as the other empty states in the app: light icon + short grey sentence
  const emptyOverlay = (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <span className="text-sm font-medium text-gray-400">{sl ? 'Ni podatkov' : 'No data'}</span>
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
        {(() => { const n = [statusFilter, categoryFilter, sourceFilter, typeFilter, channelFilter, assigneeFilter, filterCustomerId].filter(Boolean).length
          return <button type="button" onClick={() => setFiltersOpen(x => !x)}
            className="sm:hidden h-9 px-3.5 rounded-[10px] border border-gray-200 bg-white text-sm font-medium text-gray-900 inline-flex items-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            {sl ? 'Filtri' : 'Filters'}{n > 0 && <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold">{n}</span>}
          </button> })()}
        <div className={cn('flex-wrap items-center gap-2', filtersOpen ? 'flex' : 'hidden sm:flex')}>

          {/* dates from – to, with quick choices */}
          <DateRangeFilter label={sl ? 'Obdobje' : 'Period'} allLabel={sl ? 'Vsa' : 'Any time'} from={dateFrom} to={dateTo} onChange={(fr, to) => { setDateFrom(fr); setDateTo(to) }} />

          <FilterSelect compact label={sl ? 'Status' : 'Status'} value={statusFilter} allLabel={sl ? 'Vsi' : 'All'} onChange={setStatusFilter}
            options={[{ value: 'draft', label: sl ? 'Osnutki' : 'Drafts' }, { value: 'issued', label: sl ? 'Izdane' : 'Issued' }, { value: 'sent', label: sl ? 'Poslane' : 'Sent' }, { value: 'won', label: sl ? 'Dobljene' : 'Won' }, { value: 'lost', label: sl ? 'Izgubljene' : 'Lost' }]} />

          <FilterSelect compact label={sl ? 'Izvor' : 'Source'} value={sourceFilter} allLabel={sl ? 'Vsi' : 'All'} onChange={setSourceFilter}
            options={[{ value: 'configurator', label: sl ? 'Prek konfiguratorja' : 'Via configurator' }, { value: 'app', label: sl ? 'Ročno kreirane' : 'Created manually' }]} />

          <FilterSelect compact label={sl ? 'Prodajni kanal' : 'Sales channel'} value={channelFilter} allLabel={sl ? 'Vsi' : 'All'} onChange={setChannelFilter}
            options={leadSourceOptions(sl ? 'sl' : 'en')} />

          <FilterSelect compact label={sl ? 'Kategorija' : 'Category'} value={categoryFilter} allLabel={sl ? 'Vse' : 'All'} onChange={setCategoryFilter}
            options={CATEGORIES.map(c => ({ value: c.key, label: sl ? c.sl : c.en }))} />

          <FilterSelect compact label={sl ? 'Tip stranke' : 'Customer type'} value={typeFilter} allLabel={sl ? 'Vsi' : 'All'} onChange={setTypeFilter}
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
                <div className="px-3 py-2 text-sm text-gray-600 hover:bg-[#fbfbfb] cursor-pointer"
                  onClick={() => { setFilterCustomerId(null); setSearchText(''); setShowDropdown(false) }}>
                  {sl ? 'Vse stranke' : 'All customers'}
                </div>
                {customers.filter(c => c.customer_name.toLowerCase().includes(searchText.toLowerCase())).map(c => (
                  <div key={c.customer_id}
                    className={`px-3 py-2 text-sm cursor-pointer border-t border-gray-100 hover:bg-[#fbfbfb] ${filterCustomerId === c.customer_id ? 'text-gray-900 font-medium' : 'text-gray-700'}`}
                    onClick={() => { setFilterCustomerId(c.customer_id); setSearchText(c.customer_name); setShowDropdown(false) }}>
                    {c.customer_name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {(statusFilter || categoryFilter || sourceFilter || typeFilter || channelFilter || assigneeFilter || filterCustomerId || dateTo) && (
            <button type="button" onClick={() => { setStatusFilter(''); setSourceFilter(''); setTypeFilter(''); setChannelFilter(''); setAssigneeFilter(''); setFilterCustomerId(null); setSearchText(''); setDateTo(''); const d = new Date(); d.setDate(d.getDate() - 90); setDateFrom(d.toISOString().slice(0, 10)) }}
              className="h-8 px-2.5 rounded-[10px] text-sm font-medium text-[#5e5e5e] hover:text-gray-900 hover:bg-gray-100 transition-colors">{sl ? 'Počisti filtre' : 'Clear filters'}</button>
          )}
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">

        {/* four cards: what is still in play, won, lost, and how often we win */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={Send} tone="blue" label={sl ? 'Odprta povpraševanja in ponudbe' : 'Open enquiries and quotes'} value={money(kpi.open.value)} sub={countQuotes(lang, kpi.open.count)} delta={vsBefore(kpi.open.value, before?.open.value)} />
          <StatCard icon={Trophy} tone="blue" label={sl ? 'Dobljene ponudbe' : 'Won quotes'} value={money(kpi.won.value)} sub={countQuotes(lang, kpi.won.count)} delta={vsBefore(kpi.won.value, before?.won.value)} />
          <StatCard icon={XCircle} tone="blue" label={sl ? 'Izgubljene ponudbe' : 'Lost quotes'} value={money(kpi.lost.value)} sub={countQuotes(lang, kpi.lost.count)} delta={vsBefore(kpi.lost.value, before?.lost.value)} />
          <StatCard icon={Percent} tone="green" label={sl ? 'Uspešnost ponudb' : 'Win rate'} value={kpi.rate == null ? '—' : `${kpi.rate} %`}
            sub={kpi.rateN == null ? (sl ? 'Ni zaključenih ponudb' : 'Nothing decided yet')
              : sl ? `${kpi.rateN} % po številu · ${countQuotes(lang, kpi.decidedN)}` : `${kpi.rateN} % by count · ${countQuotes(lang, kpi.decidedN)}`}
            delta={vsBefore(kpi.rate, before?.rate, true)} />
        </div>

        {/* the funnel in one strip: every status with its count and value */}
        <div className="bg-white rounded-xl border border-gray-200 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-y lg:divide-y-0 divide-gray-100 overflow-hidden">
          {funnel.map(f => (
            <div key={f.key} className="px-4 py-3.5 min-w-0">
              <p className="text-xs font-medium text-label leading-4 min-h-8">{f.label}</p>
              <p className="text-lg font-semibold mt-0.5 tabular-nums text-gray-900">{f.count}</p>
              <p className="text-xs text-[#7f7f7f] tabular-nums truncate" title={f.value ? money(f.value) : undefined}>{f.value ? money(f.value) : '—'}</p>
            </div>
          ))}
        </div>


        {/* one chart, read in euros or in quotes; the colour follows the measure: value blue, count green */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              {timeMetric === 'value' ? (sl ? 'Vrednost ponudb po času' : 'Quote value over time') : (sl ? 'Število ponudb po času' : 'Quotes over time')}
            </h2>
            <div className="shrink-0 inline-flex rounded-[10px] border border-gray-200 p-0.5">
              {([['value', sl ? 'Vrednost' : 'Value'], ['count', sl ? 'Število' : 'Count']] as const).map(([k, lbl]) => (
                <button key={k} type="button" onClick={() => setTimeMetric(k)}
                  className={cn('h-7 px-3 rounded-lg text-xs font-medium transition-colors',
                    timeMetric === k ? 'bg-gray-900 text-white' : 'text-[#5e5e5e] hover:text-gray-900')}>{lbl}</button>
              ))}
            </div>
          </div>
          {(() => {
            const isValue = timeMetric === 'value'
            const has = isValue ? hasValues : hasCounts
            const tone = isValue ? BLUE : GREEN
            const fmt = (v: number) => (isValue ? moneyK(v) : String(v))
            return <div className="relative"><ResponsiveContainer width="100%" height={300}>
              <BarChart data={has ? months : ghostMonths} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barGap={4} barCategoryGap="24%">
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeff1" vertical={false} />
                <XAxis dataKey="period" tickFormatter={formatPeriod} tick={{ fontSize: 12, fill: '#5e5e5e' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, (m: number) => m || (isValue ? 4000 : 4)]} allowDecimals={isValue} tickFormatter={fmt} width={isValue ? 64 : 36}
                  tick={has ? { fontSize: 12, fill: '#5e5e5e' } : false} axisLine={false} tickLine={false} />
                {has && <Tooltip cursor={{ fill: '#f4f4f5' }} formatter={(v) => (isValue ? money(v as number) : String(v))} labelFormatter={l => formatPeriod(String(l))}
                  contentStyle={{ borderRadius: 10, border: '1px solid #eeeff1', fontSize: 13, fontWeight: 500 }} />}
                <Legend iconType="square" iconSize={8} itemSorter={(it: any) => LEGEND_ORDER.indexOf(it.dataKey)} wrapperStyle={{ fontSize: 12, color: '#5e5e5e', paddingTop: 8 }} />
                <Bar isAnimationActive={false} dataKey={isValue ? 'sent_value' : 'sent_count'} name={sl ? 'Poslano' : 'Sent'} fill={has ? tone.light : GREY.light} radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {has && !dense && <LabelList position="top" formatter={(v: unknown) => (Number(v) ? (isValue ? kShort(Number(v)) : String(v)) : '')} style={{ fontSize: 11, fontWeight: 400, fill: '#5e5e5e' }} />}
                </Bar>
                <Bar isAnimationActive={false} dataKey={isValue ? 'won_value' : 'won_count'} name={sl ? 'Dobljeno' : 'Won'} fill={has ? tone.dark : GREY.dark} radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {has && !dense && <LabelList position="top" formatter={(v: unknown) => (Number(v) ? (isValue ? kShort(Number(v)) : String(v)) : '')} style={{ fontSize: 11, fontWeight: 400, fill: '#5e5e5e' }} />}
                </Bar>
              </BarChart>
            </ResponsiveContainer>{!has && emptyOverlay}</div>
          })()}
        </div>

        {/* what was offered per category, of the quotes made in the period */}
        {(() => {
          // the value of the sent quotes by category (windows, doors, roof windows, services …): all of it (light) with the won part (dark) in one bar
          const statusOfQ = new Map(inPeriod.filter(q => !isDraftLike(q.status)).map(q => [q.id, q.status]))
          const byCat = new Map<string, { key: string; name: string; total: number; won: number }>()
          for (const l of serviceLines) {
            const stq = statusOfQ.get(l.quote_id)
            if (!stq) continue
            const row = byCat.get(l.cat) ?? { key: l.cat, name: categoryLabel(l.cat, sl ? 'sl' : 'en'), total: 0, won: 0 }
            row.total += l.value; if (stq === 'won') row.won += l.value
            byCat.set(l.cat, row)
          }
          // where the quotes came from: made here, or sent in through the public configurator
          const srcAll = inPeriod.reduce((t, q) => t + (Number(q.total_net) || 0), 0)
          const sources = [
            { key: 'app', name: sl ? 'Ročno kreirane' : 'Created manually', color: GREEN.dark, f: (q: Q) => q.source !== 'configurator' },
            { key: 'configurator', name: sl ? 'Prek konfiguratorja' : 'Via configurator', color: GREEN.light, f: (q: Q) => q.source === 'configurator' },
          ].map(x => { const qs = inPeriod.filter(x.f); return { ...x, count: qs.length, value: qs.reduce((t, q) => t + (Number(q.total_net) || 0), 0) } }).filter(x => x.count > 0)
          const topServices = [...byCat.values()].sort((a, b) => b.total - a.total)
            .map(x => ({ ...x, rest: Math.max(0, x.total - x.won), label: `${moneyK(x.total)} · ${x.total ? Math.round(x.won / x.total * 100) : 0}% ${sl ? 'dobljeno' : 'won'}` }))
          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <BreakdownCard empty={sl ? 'Ni podatkov' : 'No data'}
                  title={sl ? 'Vrednost po kategorijah' : 'Value by category'}
                  hint={sl ? 'Koliko ste v tem obdobju ponudili po skupinah izdelkov in koliko od tega ste dobili.'
                    : 'What you offered per product group in this period and how much of it you won.'}
                  legend={[{ name: sl ? 'Dobljeno' : 'Won', color: GREEN.dark }, { name: sl ? 'Ponujeno' : 'Offered', color: GREEN.light }]}>
                  {topServices.length > 0 && topServices.map(c => {
                    const max = topServices[0].total || 1
                    const all = topServices.reduce((a, x) => a + x.total, 0) || 1
                    return <BreakdownRow key={c.key} name={c.name}
                      caption={`${Math.round(c.total / all * 100)} % ${sl ? 'vrednosti' : 'of the value'}`}
                      segments={[{ w: c.won / max * 100, color: GREEN.dark }, { w: c.rest / max * 100, color: GREEN.light }]}
                      value={money(c.total)}
                      sub={c.won ? `${money(c.won)} ${sl ? 'dobljeno' : 'won'}` : '—'} />
                  })}
                </BreakdownCard>
              </div>
              <BreakdownCard empty={sl ? 'Ni podatkov' : 'No data'}
                title={sl ? 'Izvor ponudb' : 'Quote source'}
                hint={sl ? 'Koliko ponudb ste naredili sami in koliko jih je prišlo skozi spletni konfigurator.'
                  : 'How many quotes you made here and how many came in through the public configurator.'}>
                {sources.length > 0 && sources.map(x => (
                  <BreakdownRow key={x.key} name={x.name}
                    caption={countQuotes(lang, x.count)}
                    segments={[{ w: srcAll ? x.value / srcAll * 100 : 0, color: x.color }]}
                    value={money(x.value)}
                    sub={`${srcAll ? Math.round(x.value / srcAll * 100) : 0} % ${sl ? 'vrednosti' : 'of the value'}`} />
                ))}
              </BreakdownCard>
            </div>
          )
        })()}

        {/* each channel: how much it brings, and how much of what it brings ends in a job */}
        {(() => {
          const rows = LEAD_SOURCES.map(k => {
            const qs = inPeriod.filter(q => (q.lead_source ?? '') === k)
            const won = qs.filter(q => q.status === 'won')
            const lost = qs.filter(q => q.status === 'lost').length
            return { key: k as string, name: leadSourceLabel(k, sl ? 'sl' : 'en'), won: won.length, decided: won.length + lost,
              count: qs.length, value: qs.reduce((a, q) => a + (Number(q.total_net) || 0), 0),
              wonValue: won.reduce((a, q) => a + (Number(q.total_net) || 0), 0), open: qs.length - won.length - lost }
          }).filter(r => r.count > 0)
          // best rate first; a channel with nothing decided yet cannot be ranked, so it goes last
          rows.sort((a, b) => (b.decided ? b.won / b.decided : -1) - (a.decided ? a.won / a.decided : -1) || b.decided - a.decided)
          const best = rows.find(r => r.decided > 0 && r.won > 0)
          return (
            <BreakdownCard empty={sl ? 'Ni podatkov' : 'No data'}
              title={sl ? 'Prodajni kanali' : 'Sales channels'}
              hint={sl ? 'Koliko ponudb prinese posamezen prodajni kanal in kolikšen delež pridobljenih poslov imate med njegovimi zaključenimi ponudbami. Iz grafa lahko razberete, kateri kanal vam prinese največ ponudb in kateri največji delež poslov.'
                : 'How many quotes each sales channel brings and the share of won jobs among its decided quotes. It tells you which channel brings the most quotes and which the biggest share of jobs.'}>
              {rows.length > 0 && rows.map(r => {
                const pct = r.decided ? Math.round(r.won / r.decided * 100) : null
                return <BreakdownRow key={r.key} name={r.name}
                  caption={`${countQuotes(lang, r.count)} · ${money(r.value)}`}
                  segments={pct ? [{ w: pct, color: best && r.key === best.key ? BLUE.dark : BLUE.mid }] : []}
                  value={pct == null ? '—' : `${pct} %`}
                  sub={pct == null ? countOpen(sl ? 'sl' : 'en', r.open) : `${r.won} ${sl ? 'od' : 'of'} ${r.decided} ${sl ? 'zaključenih' : 'decided'}`} />
              })}
            </BreakdownCard>
          )
        })()}


        {/* the customers of the quotes made in the period */}
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
          const th = (key: typeof cSort.key, label: string, right = true, wide = false) => (
            <th className={`${right ? 'text-right' : 'text-left'} ${wide ? 'hidden sm:table-cell' : ''} px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap cursor-pointer select-none hover:text-gray-700`}
              onClick={() => { setCSort(s0 => ({ key, dir: s0.key === key && s0.dir === 'desc' ? 'asc' : 'desc' })); setCPage(1) }}>
              <span className="inline-flex items-center gap-0.5">{label}<SortIcon active={cSort.key === key} dir={cSort.dir} /></span>
            </th>
          )
          return (
            <div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 flex flex-col lg:min-h-[789px]">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 px-6 pt-6 pb-4">{sl ? 'Stranke' : 'Customers'}
                  <span className="inline-flex items-center h-[22px] px-2 rounded-md bg-[#f4f4f5] text-[#7f7f7f] text-xs font-medium tabular-nums">{sorted.length}</span></h2>
                <div className="overflow-x-auto"><table className="w-full table-fixed text-sm font-medium">
                  <colgroup><col /><col className="w-[84px] sm:w-[110px]" /><col className="w-[110px] sm:w-[130px]" /><col className="hidden sm:table-column w-[130px]" /><col className="hidden sm:table-column w-[120px]" /></colgroup>
                  <thead className="bg-gray-50 border-y border-gray-200"><tr>
                    {th('name', sl ? 'Stranka' : 'Customer', false)}
                    {th('count', sl ? 'Ponudbe' : 'Quotes')}
                    {th('value', sl ? 'Vrednost' : 'Value')}
                    {th('won', sl ? 'Dobljeno' : 'Won', true, true)}
                    {th('rate', sl ? 'Uspešnost' : 'Win rate', true, true)}
                  </tr></thead>
                  {/* border-b: a line under the last customer too, not only between the rows */}
                  <tbody className="divide-y divide-gray-200 border-b border-gray-200">
                    {top.map(c => <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3"><div className="truncate" title={c.name}>{c.name}</div></td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-[#5e5e5e]">{c.count}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{money(c.value)}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-right whitespace-nowrap">{c.won ? money(c.won) : '—'}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-right whitespace-nowrap text-[#5e5e5e]">{c.value ? `${Math.round(c.won / c.value * 100)}%` : '—'}</td>
                    </tr>)}
                  </tbody>
                </table></div>
                {top.length === 0 && <div className="flex-1 flex items-center justify-center min-h-[220px] text-sm font-medium text-gray-400">{sl ? 'Ni podatkov' : 'No data'}</div>}
                <Pagination total={sorted.length} page={cPage} pageSize={cPageSize} onChange={setCPage} fixedSize />
              </div>
            </div>
          )
        })()}

      </div>
    </div>
  )
}
