import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Building2, Users, TrendingUp, Power, PowerOff, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import Button from '../components/ui/Button'

interface Company {
  id: string
  name: string
  is_active: boolean
  created_at: string
  user_count?: number
}

interface UserRow {
  id: string
  first_name: string
  last_name: string
  email: string
  company_id: string
  company_name?: string
  created_at: string
  is_super_admin: boolean
}

interface Stats {
  total_companies: number
  total_users: number
  new_this_month: number
  growth: { month: string; count: number }[]
}

export default function SuperAdminPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null)
  const [tab, setTab] = useState<'stats' | 'companies' | 'users'>('stats')
  const [stats, setStats] = useState<Stats | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('is_super_admin').then(({ data }) => {
      setIsSuperAdmin(!!data)
      if (data) loadAll()
      else setLoading(false)
    })
  }, [])

  async function loadAll() {
    setLoading(true)
    const [statsRes, companiesRes, usersRes] = await Promise.all([
      supabase.rpc('get_platform_stats'),
      supabase.from('companies').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('id, first_name, last_name, email, company_id, created_at, is_super_admin').order('created_at', { ascending: false }),
    ])

    if (statsRes.data) setStats(statsRes.data as Stats)

    if (companiesRes.data) {
      const companyList = companiesRes.data as Company[]
      const userCounts: Record<string, number> = {}
      if (usersRes.data) {
        for (const u of usersRes.data as UserRow[]) {
          userCounts[u.company_id] = (userCounts[u.company_id] || 0) + 1
        }
      }
      setCompanies(companyList.map(c => ({ ...c, user_count: userCounts[c.id] || 0 })))
    }

    if (usersRes.data && companiesRes.data) {
      const nameMap: Record<string, string> = {}
      for (const c of companiesRes.data as Company[]) nameMap[c.id] = c.name
      setUsers((usersRes.data as UserRow[]).map(u => ({ ...u, company_name: nameMap[u.company_id] || '—' })))
    }

    setLoading(false)
  }

  async function toggleCompany(company: Company) {
    setToggling(company.id)
    const { error } = await supabase
      .from('companies')
      .update({ is_active: !company.is_active })
      .eq('id', company.id)
    if (error) toast('Napaka pri posodobitvi', 'error')
    else {
      toast(company.is_active ? 'Podjetje deaktivirano' : 'Podjetje aktivirano', 'success')
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, is_active: !c.is_active } : c))
    }
    setToggling(null)
  }

  if (isSuperAdmin === null) return null
  if (isSuperAdmin === false) return <Navigate to="/dashboard" replace />

  const formatDate = (s: string) => new Date(s).toLocaleDateString('sl-SI')

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Super admin</h1>
          <p className="text-sm text-gray-500 mt-1">Obrtdesk platform overview</p>
        </div>
        <Button variant="secondary" onClick={loadAll} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          OsveĹľi
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['stats', 'companies', 'users'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${tab === t ? 'text-blue-600 border-b-2 border-blue-600 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'stats' ? 'Pregled' : t === 'companies' ? 'Podjetja' : 'Uporabniki'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Nalagam...</div>
      ) : (
        <>
          {tab === 'stats' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <StatCard icon={<Building2 size={20} />} label="Podjetja" value={stats.total_companies} />
                <StatCard icon={<Users size={20} />} label="Aktivni uporabniki" value={stats.total_users} />
                <StatCard icon={<TrendingUp size={20} />} label="Nova podjetja ta mesec" value={stats.new_this_month} />
              </div>

              {stats.growth.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Rast podjetij (12 mesecev)</h3>
                  <div className="flex items-end gap-2 h-32">
                    {stats.growth.map(g => {
                      const max = Math.max(...stats.growth.map(x => x.count), 1)
                      const pct = (g.count / max) * 100
                      return (
                        <div key={g.month} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-500">{g.count}</span>
                          <div className="w-full bg-blue-100 rounded-sm" style={{ height: `${pct}%`, minHeight: 4 }}>
                            <div className="w-full h-full bg-blue-500 rounded-sm" />
                          </div>
                          <span className="text-xs text-gray-400">{g.month.slice(5)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'companies' && (
            <div className="-mx-4 lg:-mx-6 border-t border-b border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Podjetje</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Registracija</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Uporabniki</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {companies.map(c => (
                    <tr key={c.id} className="border-t border-gray-50 hover:bg-[#fbfbfb]">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{c.user_count}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {c.is_active ? 'Aktivno' : 'Deaktivirano'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleCompany(c)}
                          disabled={toggling === c.id}
                          title={c.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-40 transition-colors"
                        >
                          {c.is_active ? <PowerOff size={15} /> : <Power size={15} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {companies.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Ni podjetij</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'users' && (
            <div className="-mx-4 lg:-mx-6 border-t border-b border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Uporabnik</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">E-poĹˇta</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Podjetje</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Registracija</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-t border-gray-50 hover:bg-[#fbfbfb]">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {u.first_name} {u.last_name}
                        {u.is_super_admin && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">admin</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{u.email}</td>
                      <td className="px-4 py-3 text-gray-600">{u.company_name}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Ni uporabnikov</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className="text-blue-600 bg-blue-50 p-2.5 rounded-lg">{icon}</div>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}
