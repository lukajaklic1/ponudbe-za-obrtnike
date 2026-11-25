import { useEffect, useState } from 'react'
import { Plus, Users, Mail, X, UserCog, MoreVertical } from 'lucide-react'
import Checkbox from '../components/ui/Checkbox'
import { SortIcon } from '../components/ui/SortIcon'
import { FilterSelect } from '../components/ui/FilterSelect'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Pagination, { usePageSize } from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { SearchBar, FilterTabs } from '../components/ui/ListToolbar'
import { Avatar } from '../components/ui/PersonBadge'
import type { User as AppUser, UserPermission, UserInvitation } from '../types/database'

const MODULES: UserPermission['module'][] = ['quotes', 'customers', 'price_list']

// Small teams: no per-module matrix. Every member can work on quotes, customers and
// the price list; only admins delete, invite people and change company settings.
function fullAccess() {
  return MODULES.map(module => ({ module, can_view: true, can_create: true, can_approve: true, can_pay: false }))
}

export default function UsersPage() {
  const { company, isAdmin, loading } = useCompany()
  const { t, lang } = useLanguage()
  const ph = lang === 'en' ? { first: 'John', last: 'Smith', email: 'john.smith@company.com' } : { first: 'Janez', last: 'Novak', email: 'janez.novak@podjetje.si' }
  const s = t.settings
  const [users, setUsers] = useState<AppUser[]>([])
  const [invites, setInvites] = useState<UserInvitation[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize('users')
  const [sortKey, setSortKey] = useState<'name' | 'role' | 'status'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'member'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  function handleSort(k: typeof sortKey) { setSortKey(k); setSortDir(d => k === sortKey ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); setPage(1) }

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inv, setInv] = useState({ first_name: '', last_name: '', email: '' })
  const [inviteAsAdmin, setInviteAsAdmin] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)

  // Edit user modal
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', is_admin: false })
  const [savingPerms, setSavingPerms] = useState(false)

  useEffect(() => { if (company && isAdmin) load() }, [company, isAdmin])

  async function load() {
    if (!company) return
    // spinner only on first load (initial state) — reloads keep the current view on screen
    const [{ data: usersData }, { data: invitesData }] = await Promise.all([
      supabase.from('users').select('*').eq('company_id', company.id).order('first_name'),
      supabase.from('user_invitations').select('*').eq('company_id', company.id).eq('status', 'pending').order('created_at', { ascending: false }),
    ])
    setUsers((usersData as AppUser[]) ?? [])
    setInvites((invitesData as UserInvitation[]) ?? [])
    setDataLoading(false)
  }

  // Primary admin = company founder (oldest admin) — never editable
  const primaryAdminId = users
    .filter(u => u.is_admin)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]?.id

  // ── Invite ──
  function openInvite() {
    setInv({ first_name: '', last_name: '', email: '' })
    setInviteAsAdmin(false); setSentTo(null); setInviteOpen(true)
  }

  async function sendInvite() {
    if (!company || !inv.email.trim() || !inv.first_name.trim() || !inv.last_name.trim()) return
    setInviting(true)
    const email = inv.email.trim()
    const permissions = fullAccess()
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: {
        email,
        first_name: inv.first_name.trim(),
        last_name: inv.last_name.trim(),
        department_id: null,
        job_title: null,
        is_admin: inviteAsAdmin,
        permissions,
        redirect_to: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/accept-invite`,
      },
    })
    setInviting(false)
    if (error || (data as { error?: string })?.error) {
      toast.error(error?.message ?? (data as { error?: string }).error ?? 'Error')
      return
    }
    setSentTo(email)
    toast.success(t.common.saved)
    load()
  }

  async function revokeInvite(invite: UserInvitation) {
    const { error } = await supabase.from('user_invitations').update({ status: 'revoked' }).eq('id', invite.id)
    if (error) { toast.error(error.message); return }
    toast.success(t.common.deleted); load()
  }

  // ── Edit user ──
  function openEdit(u: AppUser) {
    setEditForm({
      first_name: u.first_name ?? '', last_name: u.last_name ?? '',
      is_admin: u.is_admin,
    })
    setEditUser(u)
  }

  async function toggleActive(u: AppUser) {
    const { error } = await supabase.rpc('set_user_active', { p_user_id: u.id, p_active: !u.is_active })
    if (error) { toast.error(error.message); return }
    toast.success(t.common.saved)
    load()
  }

  async function saveUser() {
    if (!editUser) return
    if (!editForm.first_name.trim() || !editForm.last_name.trim()) return
    setSavingPerms(true)
    const { error: uErr } = await supabase.from('users').update({
      first_name: editForm.first_name.trim(),
      last_name: editForm.last_name.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', editUser.id)
    if (uErr) { setSavingPerms(false); toast.error(uErr.message); return }

    if (editForm.is_admin !== editUser.is_admin) {
      const { error: aErr } = await supabase.rpc('set_user_admin', { p_user_id: editUser.id, p_is_admin: editForm.is_admin })
      if (aErr) { setSavingPerms(false); toast.error(aErr.message); return }
    }

    if (!editForm.is_admin) {
      const rows = fullAccess().map(p => ({ user_id: editUser.id, ...p }))
      const { error: pErr } = await supabase.from('user_permissions').upsert(rows, { onConflict: 'user_id,module' })
      if (pErr) { setSavingPerms(false); toast.error(pErr.message); return }
    }
    setSavingPerms(false)
    toast.success(t.common.saved)
    setEditUser(null)
    load()
  }

  const filteredUsers = users.filter(u =>
    (!search || `${u.first_name} ${u.last_name} ${u.email ?? ''}`.toLowerCase().includes(search.toLowerCase())) &&
    (roleFilter === 'all' || (roleFilter === 'admin' ? u.is_admin : !u.is_admin)) &&
    (statusFilter === 'all' || (statusFilter === 'active' ? u.is_active : !u.is_active))
  )
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'name') return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`) * mul
    if (sortKey === 'role') return (Number(b.is_admin) - Number(a.is_admin)) * mul
    if (sortKey === 'status') return (Number(b.is_active) - Number(a.is_active)) * mul
    return 0
  })
  const allRows = [...sortedUsers, ...invites]
  const paginated = allRows.slice((page - 1) * pageSize, page * pageSize)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
  if (!loading && !isAdmin) return <Navigate to="/dashboard" replace />

  return (
    <div>
      <PageHeader title={t.nav.users} icon={UserCog} action={<Button onClick={openInvite} className="gap-2"><Plus className="w-4 h-4" />{s.addUser}</Button>} />
      <div className="px-6 py-5">
      <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder={t.common.search} />
      <FilterTabs<typeof statusFilter>
        tabs={[
          { key: 'all', label: t.common.all, count: users.length + invites.length },
          { key: 'active', label: t.common.active, count: users.filter(u => u.is_active).length },
          { key: 'inactive', label: t.common.deactivated, count: users.filter(u => !u.is_active).length },
        ]}
        active={statusFilter}
        onChange={k => { setStatusFilter(k); setPage(1) }}
        right={
        <FilterSelect label={s.role} value={roleFilter === 'all' ? '' : roleFilter} allLabel={t.common.all}
          options={[{ value: 'admin', label: s.admin }, { value: 'member', label: s.member }]}
          onChange={v => { setRoleFilter((v || 'all') as typeof roleFilter); setPage(1) }} />} />
      <div className="table-frame">
        {dataLoading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
        ) : users.length === 0 && invites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Users className="w-10 h-10 text-[#e9e8e3] mb-3" />
            <p className="text-sm text-[#6a6a6a]">{s.noUsers}</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm font-medium min-w-[700px]">
            <thead>
              <tr>
                {([['name', t.common.name], ['', t.common.email], ['role', s.role], ['status', t.common.status], ['', '']] as [string, string][]).map(([key, h], i) => (
                  <th key={i} className={`text-left px-4 py-3 text-xs font-medium text-[#6a6a6a] whitespace-nowrap ${key ? 'cursor-pointer select-none hover:text-black' : ''}`}
                    onClick={() => key && handleSort(key as typeof sortKey)}>
                    <span className="inline-flex items-center gap-0.5">{h}{key && <SortIcon active={sortKey === key} dir={sortDir} />}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(item => {
                const u = 'is_admin' in item && 'first_name' in item && 'last_name' in item && 'email' in item && 'job_title' in item && !('status' in item) ? (item as AppUser) : null
                const invite = u ? null : (item as UserInvitation)
                return u ? (
                  <tr key={u.id} className="hover:bg-[#f5f3ef] transition-colors cursor-pointer" onClick={() => openEdit(u)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-2.5 font-medium text-black"><Avatar name={`${u.first_name} ${u.last_name}`} />{u.first_name} {u.last_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#6a6a6a] whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium" style={u.is_admin ? { backgroundColor: '#e9e8e3', color: '#000000' } : { backgroundColor: '#f5f3ef', color: '#6a6a6a' }}>
                        {u.is_admin ? s.admin : s.member}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_active
                        ? <span className="inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium" style={{ backgroundColor: '#e9e8e3', color: '#000000' }}>{t.common.active}</span>
                        : <span className="inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium" style={{ backgroundColor: '#f5f3ef', color: '#6a6a6a' }}>{s.inactive}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(u)} title={s.editPermissions}
                          className="p-1.5 text-[#6a6a6a] hover:text-black hover:bg-[#e9e8e3] rounded-lg transition-colors"><MoreVertical className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ) : invite ? (
                  <tr key={invite.id} className="hover:bg-[#f5f3ef] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#f5f3ef' }}>
                          <Mail className="w-3.5 h-3.5" style={{ color: '#6a6a6a' }} />
                        </div>
                        <span className="text-[#6a6a6a]">{invite.first_name} {invite.last_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#6a6a6a] whitespace-nowrap">{invite.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium ${invite.is_admin ? 'bg-[#e9e8e3] text-black' : 'bg-[#f5f3ef] text-[#6a6a6a]'}`}>
                        {invite.is_admin ? s.admin : s.member}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium" style={{ backgroundColor: '#f5f3ef', color: '#6a6a6a' }}>{s.invited}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => revokeInvite(invite)} title={s.revoke}
                          className="p-1.5 text-[#6a6a6a] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ) : null
              })}
            </tbody>
          </table></div>
        )}
      </div>

      <Pagination total={allRows.length} page={page} pageSize={pageSize} onChange={setPage} onPageSizeChange={setPageSize} />

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={s.addUser} size="lg">
        {sentTo ? (
          <div>
            <p className="text-[15px] leading-6 text-[#6a6a6a]">{s.inviteSent} <span className="font-medium text-black">{sentTo}</span>.</p>
            <div className="flex justify-end -mx-6 px-6 border-t border-[#ece9e3]">
              <Button onClick={() => setInviteOpen(false)}>{t.common.close}</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input id="inv-first" requiredMark placeholder={ph.first} label={s.firstName} value={inv.first_name} onChange={e => setInv(v => ({ ...v, first_name: e.target.value }))} />
              <Input id="inv-last" requiredMark placeholder={ph.last} label={s.lastName} value={inv.last_name} onChange={e => setInv(v => ({ ...v, last_name: e.target.value }))} />
              <div className="col-span-1 sm:col-span-2">
                <Input id="inv-email" requiredMark placeholder={ph.email} label={s.inviteEmail} type="email" value={inv.email} onChange={e => setInv(v => ({ ...v, email: e.target.value }))} />
              </div>
            </div>

            <Checkbox checked={inviteAsAdmin} onChange={setInviteAsAdmin} label={s.admin} />

            <div className="flex gap-3 justify-end -mx-6 px-6 border-t border-[#ece9e3]">
              <Button variant="secondary" onClick={() => setInviteOpen(false)}>{t.common.cancel}</Button>
              <Button loading={inviting} onClick={sendInvite}
                disabled={!inv.email.trim() || !inv.first_name.trim() || !inv.last_name.trim()}>{s.sendInvite}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit user modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`${editUser?.first_name ?? ''} ${editUser?.last_name ?? ''}`} size="lg">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input id="edit-first" requiredMark placeholder={ph.first} label={s.firstName} value={editForm.first_name} onChange={e => setEditForm(v => ({ ...v, first_name: e.target.value }))} />
            <Input id="edit-last" requiredMark placeholder={ph.last} label={s.lastName} value={editForm.last_name} onChange={e => setEditForm(v => ({ ...v, last_name: e.target.value }))} />
            <div className="col-span-1 sm:col-span-2">
              <Input id="edit-email" label={t.common.email} value={editUser?.email ?? ''} disabled readOnly />
            </div>
          </div>

          {editUser?.id !== primaryAdminId ? (
            <Checkbox checked={editForm.is_admin} onChange={v => setEditForm(f => ({ ...f, is_admin: v }))} label={s.admin} />
          ) : null}

          <div className="flex items-center justify-between mt-5 pt-4 -mx-6 px-6 border-t border-[#ece9e3]">
            {editUser?.id !== primaryAdminId ? (
              <Button variant={editUser?.is_active ? 'danger' : 'secondary'} onClick={() => { toggleActive(editUser!); setEditUser(null) }}>
                {editUser?.is_active ? s.deactivateUser : s.reactivateUser}
              </Button>
            ) : <span />}
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setEditUser(null)}>{t.common.cancel}</Button>
              <Button loading={savingPerms} onClick={saveUser}
                disabled={!editForm.first_name.trim() || !editForm.last_name.trim()}>{t.common.saveChanges}</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
    </div>
  )
}
