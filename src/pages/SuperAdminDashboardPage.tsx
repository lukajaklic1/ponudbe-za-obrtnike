import { useEffect, useState } from 'react'
import { Building2, Users, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface MonthCount { month: string; count: number }

interface Stats {
  total_companies: number
  total_users: number
  new_this_month: number
  growth: MonthCount[]
  user_growth: MonthCount[]
}

const SL_MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec']

function formatMonth(ym: string) {
  const [year, month] = ym.split('-')
  return `${SL_MONTHS[parseInt(month) - 1]} ${year}`
}

function pluralCompanies(n: number) {
  if (n === 1) return '1 podjetje'
  if (n === 2) return '2 podjetji'
  if (n === 3 || n === 4) return `${n} podjetja`
  return `${n} podjetij`
}

function pluralUsers(n: number) {
  if (n === 1) return '1 uporabnik'
  if (n === 2) return '2 uporabnika'
  if (n === 3 || n === 4) return `${n} uporabniki`
  return `${n} uporabnikov`
}

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('get_platform_stats').then(({ data }) => {
      if (data) setStats(data as Stats)
      setLoading(false)
    })
  }, [])

  return (
    <div>
      {/* Header — same style as PageHeader */}
      <div className="px-4 lg:px-6 py-4 border-b border-gray-200 bg-white flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <TrendingUp className="w-4 h-4 text-blue-500" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 leading-tight">Nadzorna plošča</h1>
          <p className="text-xs text-gray-500">Pregled platforme</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : stats ? (
        <>
          {/* KPI cards */}
          {(() => {
            const currentMonth = new Date().toISOString().slice(0, 7)
            const newUsersThisMonth = stats.user_growth.find(d => d.month === currentMonth)?.count ?? 0
            const cards = [
              { icon: Building2, label: 'Skupaj podjetij', value: pluralCompanies(stats.total_companies), bg: 'bg-blue-50', ic: 'text-blue-500' },
              { icon: Users, label: 'Aktivni uporabniki', value: pluralUsers(stats.total_users), bg: 'bg-emerald-50', ic: 'text-emerald-600' },
              { icon: TrendingUp, label: 'Nova podjetja ta mesec', value: pluralCompanies(stats.new_this_month), bg: 'bg-violet-50', ic: 'text-violet-500' },
              { icon: Users, label: 'Novi uporabniki ta mesec', value: pluralUsers(newUsersThisMonth), bg: 'bg-orange-50', ic: 'text-orange-500' },
            ]
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map(k => (
                  <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${k.bg}`}>
                      <k.icon className={`w-4 h-4 ${k.ic}`} />
                    </div>
                    <p className="text-xs font-medium text-gray-500">{k.label}</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-0.5 tracking-tight">{k.value}</p>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AreaChart
              data={toCumulative(stats.growth)}
              label="Rast podjetij"
              color="#2563eb"
              fillColor="#dbeafe"
            />
            <AreaChart
              data={toCumulative(stats.user_growth)}
              label="Rast uporabnikov"
              color="#16a34a"
              fillColor="#dcfce7"
            />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-64 text-sm text-gray-400">Ni podatkov</div>
      )}
      </div>
    </div>
  )
}

function toCumulative(data: MonthCount[]): MonthCount[] {
  let running = 0
  return data.map(d => { running += d.count; return { month: d.month, count: running } })
}

function AreaChart({ data, label, color, fillColor }: {
  data: MonthCount[]
  label: string
  color: string
  fillColor: string
}) {
  if (data.length === 0) return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center h-52 text-sm text-gray-400">
      Ni podatkov
    </div>
  )

  const W = 500, H = 160, PX = 8, PY = 16
  const maxVal = Math.max(...data.map(d => d.count), 1)
  const pts = data.map((d, i) => ({
    x: PX + (i / Math.max(data.length - 1, 1)) * (W - PX * 2),
    y: PY + (1 - d.count / maxVal) * (H - PY * 2),
    ...d,
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`

  // show at most 6 labels
  const step = Math.ceil(data.length / 6)
  const labelIndices = new Set(data.map((_, i) => i).filter(i => i === 0 || i === data.length - 1 || i % step === 0))

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className="text-lg font-bold" style={{ color }}>{data[data.length - 1]?.count ?? 0}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 140 }}>
        <path d={areaPath} fill={fillColor} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color} />
        ))}
      </svg>
      <div className="flex justify-between mt-2">
        {pts.map((p, i) =>
          labelIndices.has(i) ? (
            <span key={i} className="text-xs text-gray-400">{formatMonth(p.month)}</span>
          ) : <span key={i} />
        )}
      </div>
    </div>
  )
}

