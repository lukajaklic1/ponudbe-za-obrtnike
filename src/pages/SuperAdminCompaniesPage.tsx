import { useEffect, useState } from 'react'
import { Power, PowerOff, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import Pagination, { usePageSize } from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { SearchBar, FilterTabs } from '../components/ui/ListToolbar'

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
      <PageHeader title="Podjetja" icon={Building2} count={companies.length} />
      <div className="p-4">

        {/* Filters */}
        <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Iskanje" />
        <FilterTabs
          tabs={[
            { key: '', label: 'Vsa', count: companies.length },
            { key: 'active', label: 'Aktivna', count: companies.filter(c => c.is_active).length },
            { key: 'inactive', label: 'Deaktivirana', count: companies.filter(c => !c.is_active).length },
          ]}
          active={statusFilter}
          onChange={k => { setStatusFilter(k); setPage(1) }} />

        {/* Table */}
        <div className="table-frame">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Building2 className="w-10 h-10 text-[#e8eef7] mb-3" />
              <p className="text-sm text-[#667085]">Ni rezultatov</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-medium min-w-[640px]">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#667085] whitespace-nowrap">Podjetje</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#667085] whitespace-nowrap">Registrirano</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#667085] whitespace-nowrap">Uporabniki</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#667085] whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {paged.map(c => (
                    <tr key={c.id} className="hover:bg-[#f6f8fc] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-black">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[#667085] whitespace-nowrap">{fmt(c.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[#667085] whitespace-nowrap">{pluralUsers(c.user_count ?? 0)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium"
                          style={c.is_active
                            ? { backgroundColor: '#e8eef7', color: '#000000' }
                            : { backgroundColor: '#f6f8fc', color: '#667085' }}>
                          {c.is_active ? 'Aktivno' : 'Deaktivirano'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => toggle(c)} disabled={toggling === c.id}
                          title={c.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
                          className="p-1.5 text-[#667085] hover:text-black hover:bg-[#e8eef7] rounded-lg disabled:opacity-40 transition-colors">
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
