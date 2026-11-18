import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { LayoutDashboard, Search, X, CalendarDays, BarChart3, Tags } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'
import { supabase } from '../lib/supabase'
import { countQuotes } from '../utils/pluralize'
import { toast } from '../components/ui/Toast'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { FilterSelect } from '../components/ui/FilterSelect'

/** teal family for every chart */
const TEAL = { line: '#2fa596', fill: '#3fb8a8', light: '#a8ded6', faint: '#e3f4f1', grey: '#e4e4e4' }
type Q = { id: string; status: string; total_net: number; customer_id: string; assignee_id: string | null; created_at: string; sent_at: string | null; updated_at: string; closed_at?: string | null }

/** a value card like Levelpath: label, big number, a badge with the number of quotes (status colours), share of the total */
const TONES = { grey: { color: '#4a4a4a', backgroundColor: '#ececec' }, yellow: { color: '#8a6100', backgroundColor: '#fef3cd' }, green: { color: '#267a47', backgroundColor: '#dbfce7' } }
function StatCard({ label, value, badge, tone, sub }: { label: string; value: string; badge: string; tone: keyof typeof TONES; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
      <p className="text-[15px] font-medium text-gray-900 truncate" title={label}>{label}</p>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap xl:flex-nowrap">
        <p className="text-[24px] leading-8 font-bold text-gray-900 tracking-[-0.02em] whitespace-nowrap">{value}</p>
        <span className="inline-flex text-xs font-semibold px-[7px] py-[3px] rounded-lg whitespace-nowrap" style={TONES[tone]}>{badge}</span>
      </div>
      <p className="text-[13px] font-medium text-[#4f4f4f] mt-1.5">{sub}</p>
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

export default function DashboardPage() {
  const { company } = useCompany()
  const { t, lang } = useLanguage()
  const cur = company?.currency ?? 'EUR'
  const money = (n: number) => (n ?? 0).toLocaleString('de-DE', { style: 'currency', currency: cur, maximumFractionDigits: 0 })
  const moneyK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k €` : `${n.toFixed(0)} €`

  const [stats, setStats] = useState<Stats | null>(null)
  const [customers, setCustomers] = useState<CustomerStat[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<1 | 3 | 6 | 12>(3)
  const [filterCustomerId, setFilterCustomerId] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string>('')
  const [companyUsers, setCompanyUsers] = useState<{ id: string; first_name: string; last_name: string }[]>([])
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
      supabase.from('quotes').select('id, status, total_net, customer_id, assignee_id, created_at, sent_at, updated_at, closed_at').eq('company_id', company.id),
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

  const st = statusStats
  // quotes made in the chosen period, by their status now: the five values add up to the total
  const cards = (() => {
    const since = Date.now() - period * 30 * 86400000
    const inPeriod = quotes.filter(q => +new Date(q.created_at) >= since)
    const sum = (f: (q: Q) => boolean) => inPeriod.filter(f).reduce((acc, q) => ({ value: acc.value + (Number(q.total_net) || 0), count: acc.count + 1 }), { value: 0, count: 0 })
    const all = sum(() => true)
    const share = (v: number) => (all.value ? `${Math.round(v / all.value * 100)} % ${sl ? 'vrednosti' : 'of the value'}` : '')
    const row = (label: string, x: { value: number; count: number }, tone: 'grey' | 'yellow' | 'green', sub: string) => ({ label, value: money(x.value), badge: countQuotes(lang, x.count), tone, sub })
    const draft = sum(q => q.status === 'draft'), sent = sum(q => q.status === 'sent' || q.status === 'issued'), won = sum(q => q.status === 'won'), lost = sum(q => q.status === 'lost')
    return [
      row(sl ? 'Skupna vrednost' : 'Total value', all, 'grey', all.value ? share(all.value) : ''),
      row(sl ? 'Osnutki' : 'Drafts', draft, 'grey', share(draft.value)),
      row(sl ? 'Poslane' : 'Sent', sent, 'grey', share(sent.value)),
      row(sl ? 'Dobljene' : 'Won', won, 'grey', share(won.value)),
      row(sl ? 'Izgubljene' : 'Lost', lost, 'grey', share(lost.value)),
    ]
  })()

  const periods = [
    { v: 1 as const, sl: '30 dni', en: '30 days' },
    { v: 3 as const, sl: '3 mesece', en: '3 months' },
    { v: 6 as const, sl: '6 mesecev', en: '6 months' },
    { v: 12 as const, sl: '12 mesecev', en: '12 months' },
  ]

  // months of the chosen period: business by the day it happened (sent / won), and how each month's quotes ended
  const months = (() => {
    const n = period, now = new Date()
    const keys = Array.from({ length: n }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
    const rows = keys.map(k => ({ period: k, sent_value: 0, won_value: 0, sent_count: 0, realized_count: 0, realized_value: 0, open_count: 0, open_value: 0 }))
    const at = (d: string | null | undefined) => (d ? rows.find(r => r.period === d.slice(0, 7)) : undefined)
    for (const q of quotes) {
      if (q.status === 'draft') continue
      const v = Number(q.total_net) || 0
      const sentRow = at(q.sent_at ?? q.created_at)
      if (sentRow) {
        sentRow.sent_value += v; sentRow.sent_count++
        // how this month's quotes ended (cohort)
        if (q.status === 'won') { sentRow.realized_count++; sentRow.realized_value += v }
      }
      // business won in the month it was won
      if (q.status === 'won') { const w = at(q.closed_at ?? q.updated_at); if (w) w.won_value += v }
    }
    for (const r of rows) { r.open_count = Math.max(0, r.sent_count - r.realized_count); r.open_value = Math.max(0, r.sent_value - r.realized_value) }
    return rows
  })()
  const ratioTip = (k: 'value' | 'count') => ({ active, payload, label }: { active?: boolean; payload?: readonly { payload?: unknown }[]; label?: string | number }) => {
    if (!active || !payload?.length) return null
    const t = payload[0].payload as TrendData
    const sent = k === 'value' ? t.sent_value : t.sent_count, won = k === 'value' ? t.realized_value : t.realized_count
    const fmt = (n: number) => (k === 'value' ? money(n) : String(n))
    return <div className="rounded-[10px] border border-gray-200 bg-white px-3 py-2.5 text-[13px] font-medium shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
      <div className="text-gray-900 mb-1">{formatPeriod(String(label ?? ''))}</div>
      <div className="flex justify-between gap-6 text-[#4f4f4f]"><span>{sl ? 'Poslano' : 'Sent'}</span><span className="text-gray-900">{fmt(sent)}</span></div>
      <div className="flex justify-between gap-6 text-[#4f4f4f]"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: TEAL.line }} />{sl ? 'Dobljeno' : 'Won'}</span><span className="text-gray-900">{fmt(won)}{sent ? ` (${Math.round(won / sent * 100)} %)` : ''}</span></div>
    </div>
  }
  const hasValues = months.some(t => t.sent_value > 0 || t.won_value > 0)
  const hasCounts = months.some(t => t.sent_count > 0)
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
              className="h-8 pl-9 pr-8 border border-gray-200 rounded-[10px] text-sm bg-white text-gray-900 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 transition-colors"
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
              <h2 className="text-[15px] font-semibold text-gray-900">{sl ? 'Posel po mesecih' : 'Business per month'}</h2>
              <p className="text-[13px] font-medium text-[#4f4f4f] mt-0.5 mb-4">{sl ? 'Poslano v mesecu in dobljeno v mesecu, ko je bila ponudba sprejeta.' : 'Sent in the month, and won in the month the quote was accepted.'}</p>
              {!hasValues ? emptyChart : <ResponsiveContainer width="100%" height={260}>
                <BarChart data={months} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barGap={4} barCategoryGap="24%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ececec" vertical={false} />
                  <XAxis dataKey="period" tickFormatter={formatPeriod} tick={{ fontSize: 13, fill: '#4f4f4f', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => moneyK(v)} width={64} tick={{ fontSize: 13, fill: '#4f4f4f', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f6f6f6' }} formatter={(v) => money(v as number)} labelFormatter={l => formatPeriod(String(l))} contentStyle={{ borderRadius: 10, border: '1px solid #dfdfdf', fontSize: 13, fontWeight: 500 }} />
                  <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 13, fontWeight: 500, color: '#4f4f4f', paddingTop: 8 }} />
                  <Bar dataKey="sent_value" name={sl ? 'Poslano' : 'Sent'} fill={TEAL.light} radius={[6, 6, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="won_value" name={sl ? 'Dobljeno' : 'Won'} fill={TEAL.line} radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>}
            </div>

            {/* Count chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-[15px] font-semibold text-gray-900">{sl ? 'Uspešnost ponudb' : 'Quote win rate'}</h2>
              <p className="text-[13px] font-medium text-[#4f4f4f] mt-0.5 mb-4">{sl ? 'Ponudbe po mesecu pošiljanja in koliko jih je bilo dobljenih.' : 'Quotes by the month they were sent, and how many were won.'}</p>
              {!hasCounts ? emptyChart : <ResponsiveContainer width="100%" height={260}>
                <BarChart data={months} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ececec" vertical={false} />
                  <XAxis dataKey="period" tickFormatter={formatPeriod} tick={{ fontSize: 13, fill: '#4f4f4f', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} width={36} tick={{ fontSize: 13, fill: '#4f4f4f', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f6f6f6' }} content={ratioTip('count')} />
                  <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 13, fontWeight: 500, color: '#4f4f4f', paddingTop: 8 }} />
                  <Bar dataKey="realized_count" stackId="c" name={sl ? 'Dobljene' : 'Won'} fill={TEAL.line} maxBarSize={56} />
                  <Bar dataKey="open_count" stackId="c" name={sl ? 'Poslane, ne (še) dobljene' : 'Sent, not (yet) won'} fill={TEAL.light} radius={[6, 6, 0, 0]} maxBarSize={56} />
                </BarChart>
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
      </div>
    </div>
  )
}
