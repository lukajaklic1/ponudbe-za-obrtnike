import { useEffect, useRef, useState } from 'react'
import { Power, PowerOff, Search, Users, X, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import Pagination, { usePageSize } from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterSelect } from '../components/ui/FilterSelect'
import { SearchBar, FilterTabs } from '../components/ui/ListToolbar'
import { PersonBadge } from '../components/ui/PersonBadge'

interface UserRow {
  id: string
  first_name: string
  last_name: string
  email: string
  company_id: string
  company_name: string
  is_active: boolean
  is_admin: boolean
  is_super_admin: boolean
  created_at: string
}


export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize('sa-users')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: usrs }, { data: comps }] = await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('companies').select('id, name'),
    ])
    if (usrs && comps) {
      const nameMap: Record<string, string> = {}
      for (const c of comps) nameMap[c.id] = c.name
      setUsers(usrs.map(u => ({ ...u, company_name: nameMap[u.company_id] || '—' })))
    }
    setLoading(false)
  }

  async function toggle(u: UserRow) {
    setToggling(u.id)
    const { error } = await supabase.from('users').update({ is_active: !u.is_active }).eq('id', u.id)
    if (error) toast('Napaka pri posodobitvi', 'error')
    else {
      toast(u.is_active ? 'Uporabnik deaktiviran' : 'Uporabnik aktiviran', 'success')
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x))
    }
    setToggling(null)
  }

  const companyOptions: [string, string][] = Array.from(
    new Map(users.map(u => [u.company_id, u.company_name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]))

  const q = search.toLowerCase()
  const filtered = users.filter(u => {
    const nameMatch = !search || `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const companyMatch = companyFilter === 'all' || u.company_id === companyFilter
    const roleMatch = !roleFilter ||
      (roleFilter === 'super_admin' && u.is_super_admin) ||
      (roleFilter === 'admin' && u.is_admin && !u.is_super_admin) ||
      (roleFilter === 'user' && !u.is_admin && !u.is_super_admin)
    const statusMatch = !statusFilter ||
      (statusFilter === 'active' && u.is_active) ||
      (statusFilter === 'inactive' && !u.is_active)
    return nameMatch && companyMatch && roleMatch && statusMatch
  })
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
  const fmt = (s: string) => new Date(s).toLocaleDateString('sl-SI')
  function resetPage() { setPage(1) }

  return (
    <div>
      <PageHeader title="Uporabniki" icon={Users} count={users.length} />
      <div className="p-4">

        {/* Filters */}
        <SearchBar value={search} onChange={v => { setSearch(v); resetPage() }} placeholder="Ime, priimek ali e-pošta" />
        <FilterTabs
          tabs={[
            { key: '', label: 'Vsi', count: users.length },
            { key: 'active', label: 'Aktivni', count: users.filter(u => u.is_active).length },
            { key: 'inactive', label: 'Deaktivirani', count: users.filter(u => !u.is_active).length },
          ]}
          active={statusFilter}
          onChange={k => { setStatusFilter(k); resetPage() }}
          right={<>
          <ComboFilter options={companyOptions} value={companyFilter} onChange={v => { setCompanyFilter(v); resetPage() }}
            placeholder="Podjetje" allLabel="Vsa podjetja" />
          <FilterSelect label="Vloga" value={roleFilter} allLabel="Vse"
            options={[{ value: 'super_admin', label: 'Super admin' }, { value: 'admin', label: 'Admin' }, { value: 'user', label: 'Uporabnik' }]}
            onChange={v => { setRoleFilter(v); resetPage() }} />
          </>} />

        {/* Table */}
        <div className="table-frame">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Users className="w-10 h-10 text-[#e8eef7] mb-3" />
              <p className="text-sm text-[#667085]">Ni rezultatov</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-medium min-w-[760px]">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#667085] whitespace-nowrap">Uporabnik</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#667085] whitespace-nowrap">E-pošta</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#667085] whitespace-nowrap">Podjetje</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#667085] whitespace-nowrap">Vloga</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#667085] whitespace-nowrap">Registriran</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#667085] whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {paged.map(u => (
                    <tr key={u.id} className="hover:bg-[#f6f8fc] transition-colors">
                      <td className="px-4 py-3">
                        <PersonBadge name={`${u.first_name} ${u.last_name}`} />
                      </td>
                      <td className="px-4 py-3 text-[#667085] whitespace-nowrap">{u.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[#667085] truncate max-w-[160px]">{u.company_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_super_admin ? (
                          <span className="inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium" style={{ backgroundColor: '#e8eef7', color: '#000000' }}>Super admin</span>
                        ) : u.is_admin ? (
                          <span className="inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium" style={{ backgroundColor: '#e8eef7', color: '#000000' }}>Admin</span>
                        ) : (
                          <span className="inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium bg-[#f6f8fc] text-[#667085]">Uporabnik</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[#667085] whitespace-nowrap">{fmt(u.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium"
                          style={u.is_active
                            ? { backgroundColor: '#e8eef7', color: '#000000' }
                            : { backgroundColor: '#f6f8fc', color: '#667085' }}>
                          {u.is_active ? 'Aktiven' : 'Deaktiviran'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!u.is_super_admin && (
                          <button onClick={() => toggle(u)} disabled={toggling === u.id}
                            title={u.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
                            className="p-1.5 text-[#667085] hover:text-black hover:bg-[#e8eef7] rounded-lg disabled:opacity-40 transition-colors">
                            {u.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                        )}
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

function ComboFilter({ options, value, onChange, placeholder, allLabel }: {
  options: [string, string][]
  value: string
  onChange: (v: string) => void
  placeholder: string
  allLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selectedLabel = value === 'all' ? '' : (options.find(([id]) => id === value)?.[1] ?? '')
  const filteredOpts = options.filter(([, name]) => name.toLowerCase().includes(query.toLowerCase()))
  function pick(v: string) { onChange(v); setOpen(false); setQuery('') }

  return (
    <div className="relative" ref={ref}>
      <Search className="w-4 h-4 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        value={open ? query : selectedLabel}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={value === 'all' ? `${placeholder}…` : selectedLabel}
        className="h-9 pl-9 pr-8 rounded-lg border border-[#e4e9f2] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
      />
      {value !== 'all' && !open && (
        <button onClick={() => pick('all')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#667085] hover:text-black">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && (
        <div className="absolute z-20 mt-1 w-60 bg-white border border-[#e4e9f2] rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-60 overflow-y-auto py-1">
            <button onClick={() => pick('all')} className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-[#f6f8fc]">
              <span className="flex-1 text-[#667085]">{allLabel}</span>
              {value === 'all' && <Check className="w-4 h-4 text-black" />}
            </button>
            {filteredOpts.map(([id, name]) => (
              <button key={id} onClick={() => pick(id)} className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-[#f6f8fc]">
                <span className="flex-1 text-black truncate">{name}</span>
                {value === id && <Check className="w-4 h-4 text-black shrink-0" />}
              </button>
            ))}
            {filteredOpts.length === 0 && <p className="px-3 py-2 text-sm text-[#667085]">Ni rezultatov</p>}
          </div>
        </div>
      )}
    </div>
  )
}
