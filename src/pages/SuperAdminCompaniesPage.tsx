import { useEffect, useState } from 'react'
import { Power, PowerOff, Search, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import Pagination, { usePageSize } from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge } from '../components/ui/Badge'
import { FilterSelect } from '../components/ui/FilterSelect'

interface Company {
  id: string
  name: string
  is_active: boolean
  created_at: string
  user_count?: number
}


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
  const [pageSize, setPageSize] = usePageSize('sa-companies')

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
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
  const fmt = (s: string) => new Date(s).toLocaleDateString('sl-SI')

  return (
    <div>
      <PageHeader variant="spacious" title="Podjetja" icon={Building2} tabs={[{ label: 'Vsa podjetja', count: companies.length, active: true }]} />
      <div className="px-8 pt-6 pb-10">

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8a8f80] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Iskanje"
              className="h-10 w-80 pl-9 pr-3 rounded-lg border border-[#d4d7c9] bg-white text-sm text-[#4a5361] placeholder-[#8a8f80] focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <FilterSelect label="Status" value={statusFilter} allLabel="Vsi"
            options={[{ value: 'active', label: 'Aktivna' }, { value: 'inactive', label: 'Deaktivirana' }]}
            onChange={v => { setStatusFilter(v); setPage(1) }} />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-[#e4e6dd] bg-white overflow-hidden">
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
              <table className="w-full text-sm font-[450] min-w-[640px]">
                <thead className="bg-[#fbfbf9] border-b border-[#eceee6]">
                  <tr>
                    <th className="text-left px-4 py-4 text-sm font-medium text-[#4a5361] whitespace-nowrap">Podjetje</th>
                    <th className="text-left px-4 py-4 text-sm font-medium text-[#4a5361] whitespace-nowrap">Registrirano</th>
                    <th className="text-left px-4 py-4 text-sm font-medium text-[#4a5361] whitespace-nowrap">Uporabniki</th>
                    <th className="text-left px-4 py-4 text-sm font-medium text-[#4a5361] whitespace-nowrap">Status</th>
                    <th className="px-4 py-4 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4e6dd]">
                  {paged.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#101112] whitespace-nowrap">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="whitespace-nowrap">{fmt(c.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="whitespace-nowrap">{pluralUsers(c.user_count ?? 0)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={c.is_active ? 'green' : 'neutral'}>{c.is_active ? 'Aktivno' : 'Deaktivirano'}</Badge>
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
        <Pagination total={filtered.length} page={page} pageSize={pageSize} onChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  )
}
