import { useEffect, useState } from 'react'
import { Power, PowerOff, Search, Building2, CalendarDays, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import Pagination from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterSelect } from '../components/ui/FilterSelect'

interface Company {
  id: string
  name: string
  is_active: boolean
  created_at: string
  user_count?: number
}

const PAGE_SIZE = 20

function pluralUsers(n: number) {
  if (n === 1) return '1 uporabnik'
  if (n === 2) return '2 uporabnika'
  if (n === 3 || n === 4) return `${n} uporabniki`
  return `${n} uporabnikov`
}

export default function SuperAdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: comps }, { data: users }] = await Promise.all([
      supabase.from('companies').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('company_id'),
    ])
    if (comps) {
      const counts: Record<string, number> = {}
      for (const u of users ?? []) counts[u.company_id] = (counts[u.company_id] || 0) + 1
      setCompanies(comps.map(c => ({ ...c, user_count: counts[c.id] || 0 })))
    }
    setLoading(false)
  }

  async function toggle(c: Company) {
    setToggling(c.id)
    const { error } = await supabase.from('companies').update({ is_active: !c.is_active }).eq('id', c.id)
    if (error) toast('Napaka pri posodobitvi', 'error')
    else {
      toast(c.is_active ? 'Podjetje deaktivirano' : 'Podjetje aktivirano', 'success')
      setCompanies(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x))
    }
    setToggling(null)
  }

  const q = search.toLowerCase()
  const filtered = companies.filter(c => {
    const nameMatch = !search || c.name.toLowerCase().includes(q)
    const statusMatch = !statusFilter ||
      (statusFilter === 'active' && c.is_active) ||
      (statusFilter === 'inactive' && !c.is_active)
    return nameMatch && statusMatch
  })
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const fmt = (s: string) => new Date(s).toLocaleDateString('sl-SI')

  return (
    <div>
      <PageHeader title="Podjetja" icon={Building2} count={companies.length} />
      <div className="p-4">

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Iskanje"
              className="w-full pl-9 pr-3 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <FilterSelect label="Status" value={statusFilter} allLabel="Vsi"
            options={[{ value: 'active', label: 'Aktivna' }, { value: 'inactive', label: 'Deaktivirana' }]}
            onChange={v => { setStatusFilter(v); setPage(1) }} />
        </div>

        {/* Table */}
        <div className="-mx-4 border-t border-b border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Building2 className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Ni rezultatov</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Podjetje</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Registrirano</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Uporabniki</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paged.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#e5eeff', border: '1px solid #d6e5ff' }}>
                            <Building2 className="w-3.5 h-3.5" style={{ color: '#215bcf' }} />
                          </div>
                          <span className="font-medium text-gray-900">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-200 text-xs text-gray-900 whitespace-nowrap" style={{ backgroundColor: '#fbfbfb' }}>
                          <CalendarDays className="w-3 h-3 text-gray-500 shrink-0" />{fmt(c.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                          {pluralUsers(c.user_count ?? 0)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium"
                          style={c.is_active
                            ? { backgroundColor: '#e0fced', border: '1px solid #d4f8e6', color: '#098259' }
                            : { backgroundColor: '#f5f5f5', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                          {c.is_active ? 'Aktivno' : 'Deaktivirano'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => toggle(c)} disabled={toggling === c.id}
                          title={c.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-40 transition-colors">
                          {c.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>
    </div>
  )
}
