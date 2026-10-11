import { useEffect, useRef, useState } from 'react'
import { Power, PowerOff, Search, Users, CalendarDays, X, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import Pagination from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterSelect } from '../components/ui/FilterSelect'
import { PersonBadge } from '../components/ui/PersonBadge'
import { Building2 } from 'lucide-react'

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

const PAGE_SIZE = 20

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

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
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const fmt = (s: string) => new Date(s).toLocaleDateString('sl-SI')
  function resetPage() { setPage(1) }

  return (
    <div>
      <PageHeader title="Uporabniki" icon={Users} count={users.length} />
      <div className="p-4">

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={search} onChange={e => { setSearch(e.target.value); resetPage() }} placeholder="Ime, priimek ali e-pošta"
              className="w-full pl-9 pr-3 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <ComboFilter options={companyOptions} value={companyFilter} onChange={v => { setCompanyFilter(v); resetPage() }}
            placeholder="Podjetje" allLabel="Vsa podjetja" />
          <FilterSelect label="Vloga" value={roleFilter} allLabel="Vse"
            options={[{ value: 'super_admin', label: 'Super admin' }, { value: 'admin', label: 'Admin' }, { value: 'user', label: 'Uporabnik' }]}
            onChange={v => { setRoleFilter(v); resetPage() }} />
          <FilterSelect label="Status" value={statusFilter} allLabel="Vsi"
            options={[{ value: 'active', label: 'Aktivni' }, { value: 'inactive', label: 'Deaktivirani' }]}
            onChange={v => { setStatusFilter(v); resetPage() }} />
        </div>

        {/* Table */}
        <div className="-mx-4 border-t border-b border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Users className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Ni rezultatov</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Uporabnik</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">E-pošta</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Podjetje</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vloga</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Registriran</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paged.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <PersonBadge name={`${u.first_name} ${u.last_name}`} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: '#e5eeff', border: '1px solid #d6e5ff' }}>
                            <Building2 className="w-3 h-3" style={{ color: '#215bcf' }} />
                          </div>
                          <span className="text-gray-700 truncate max-w-[160px]">{u.company_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_super_admin ? (
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: '#e5eeff', border: '1px solid #d6e5ff', color: '#215bcf' }}>Super admin</span>
                        ) : u.is_admin ? (
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: '#f3e8ff', border: '1px solid #ead5ff', color: '#7e22ce' }}>Admin</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-500">Uporabnik</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-200 text-xs text-gray-900 whitespace-nowrap" style={{ backgroundColor: '#fbfbfb' }}>
                          <CalendarDays className="w-3 h-3 text-gray-500 shrink-0" />{fmt(u.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium"
                          style={u.is_active
                            ? { backgroundColor: '#e0fced', border: '1px solid #d4f8e6', color: '#098259' }
                            : { backgroundColor: '#f5f5f5', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                          {u.is_active ? 'Aktiven' : 'Deaktiviran'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!u.is_super_admin && (
                          <button onClick={() => toggle(u)} disabled={toggling === u.id}
                            title={u.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-40 transition-colors">
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
        <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
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
      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        value={open ? query : selectedLabel}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={value === 'all' ? `${placeholder}…` : selectedLabel}
        className="pl-9 pr-8 py-1 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
      />
      {value !== 'all' && !open && (
        <button onClick={() => pick('all')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && (
        <div className="absolute z-20 mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-60 overflow-y-auto py-1">
            <button onClick={() => pick('all')} className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-50">
              <span className="flex-1 text-gray-500">{allLabel}</span>
              {value === 'all' && <Check className="w-4 h-4 text-blue-600" />}
            </button>
            {filteredOpts.map(([id, name]) => (
              <button key={id} onClick={() => pick(id)} className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-50">
                <span className="flex-1 text-gray-900 truncate">{name}</span>
                {value === id && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
              </button>
            ))}
            {filteredOpts.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">Ni rezultatov</p>}
          </div>
        </div>
      )}
    </div>
  )
}
