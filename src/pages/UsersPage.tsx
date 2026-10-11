import { useEffect, useState } from 'react'
import { Plus, Users, Mail, X, UserCog, MoreVertical, Search } from 'lucide-react'
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
import Pagination from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import type { User as AppUser, UserPermission, UserInvitation } from '../types/database'

const PAGE_SIZE = 20
const MODULES: UserPermission['module'][] = ['quotes', 'customers', 'price_list']

// Small teams: no per-module matrix. Every member can work on quotes, customers and
// the price list; only admins delete, invite people and change company settings.
function fullAccess() {
  return MODULES.map(module => ({ module, can_view: true, can_create: true, can_approve: true, can_pay: false }))
}

export default function UsersPage() {
  const { company, isAdmin, loading } = useCompany()
  const { t } = useLanguage()
  const s = t.settings
  const [users, setUsers] = useState<AppUser[]>([])
  const [invites, setInvites] = useState<UserInvitation[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [page, setPage] = useState(1)
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
  const paginated = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  if (!loading && !isAdmin) return <Navigate to="/dashboard" replace />

  return (
    <div>
      <PageHeader title={t.nav.users} icon={UserCog} count={users.length + invites.length} action={<Button onClick={openInvite} className="gap-2"><Plus className="w-4 h-4" />{s.addUser}</Button>} />
      <div className="p-4">
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-900 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t.common.search}
            className="pl-9 pr-3 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56" />
        </div>
        <FilterSelect label={s.role} value={roleFilter === 'all' ? '' : roleFilter} allLabel={t.common.all}
          options={[{ value: 'admin', label: s.admin }, { value: 'member', label: s.member }]}
          onChange={v => { setRoleFilter((v || 'all') as typeof roleFilter); setPage(1) }} />
        <FilterSelect label={t.common.status} value={statusFilter === 'all' ? '' : statusFilter} allLabel={t.common.all}
          options={[{ value: 'active', label: t.common.active }, { value: 'inactive', label: t.common.deactivated }]}
          onChange={v => { setStatusFilter((v || 'all') as typeof statusFilter); setPage(1) }} />
      </div>
      <div className="-mx-4 border-t border-b border-gray-200">
        {dataLoading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : users.length === 0 && invites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Users className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">{s.noUsers}</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {([['name', t.common.name], ['', t.common.email], ['role', s.role], ['status', t.common.status], ['', '']] as [string, string][]).map(([key, h], i) => (
                  <th key={i} className={`text-left px-4 py-3 text-xs font-medium text-gray-500 ${key ? 'cursor-pointer select-none hover:text-gray-700' : ''}`}
                    onClick={() => key && handleSort(key as typeof sortKey)}>
                    <span className="inline-flex items-center gap-0.5">{h}{key && <SortIcon active={sortKey === key} dir={sortDir} />}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginated.map(item => {
                const u = 'is_admin' in item && 'first_name' in item && 'last_name' in item && 'email' in item && 'job_title' in item && !('status' in item) ? (item as AppUser) : null
                const invite = u ? null : (item as UserInvitation)
                return u ? (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openEdit(u)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#e5eeff', border: '1px solid #d6e5ff' }}>
                          <UserCog className="w-3.5 h-3.5" style={{ color: '#215bcf' }} />
                        </div>
                        <span className="font-medium text-gray-900">{u.first_name} {u.last_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={u.is_admin ? { backgroundColor: '#e5eeff', border: '1px solid #d6e5ff', color: '#215bcf' } : { backgroundColor: '#f5f5f5', border: '1px solid #eeeff1', color: '#5e5e5e' }}>
                        {u.is_admin ? s.admin : s.member}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_active
                        ? <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: '#e0fced', border: '1px solid #d4f8e6', color: '#098259' }}>{t.common.active}</span>
                        : <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: '#f5f5f5', border: '1px solid #e5e7eb', color: '#6b7280' }}>{s.inactive}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(u)} title={s.editPermissions}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><MoreVertical className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ) : invite ? (
                  <tr key={invite.id} className="hover:bg-gray-50 transition-colors bg-amber-50/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#fff3cc', border: '1px solid #ffe5a0' }}>
                          <Mail className="w-3.5 h-3.5" style={{ color: '#874d00' }} />
                        </div>
                        <span className="text-gray-500">{invite.first_name} {invite.last_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{invite.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${invite.is_admin ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {invite.is_admin ? s.admin : s.member}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: '#fff3cc', border: '1px solid #ffe5a0', color: '#874d00' }}>{s.invited}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => revokeInvite(invite)} title={s.revoke}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ) : null
              })}
            </tbody>
          </table></div>
        )}
      </div>

      <Pagination total={allRows.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={s.addUser} size="lg">
        {sentTo ? (
          <div>
            <p className="text-sm text-gray-600">{s.inviteSent} <span className="font-medium text-gray-900">{sentTo}</span>.</p>
            <div className="flex justify-end mt-5">
              <Button onClick={() => setInviteOpen(false)}>{t.common.close}</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input id="inv-first" label={s.firstName} value={inv.first_name} onChange={e => setInv(v => ({ ...v, first_name: e.target.value }))} />
              <Input id="inv-last" label={s.lastName} value={inv.last_name} onChange={e => setInv(v => ({ ...v, last_name: e.target.value }))} />
              <div className="col-span-1 sm:col-span-2">
                <Input id="inv-email" label={s.inviteEmail} type="email" value={inv.email} onChange={e => setInv(v => ({ ...v, email: e.target.value }))} />
              </div>
            </div>

            <Checkbox checked={inviteAsAdmin} onChange={setInviteAsAdmin} label={s.admin} />

            <div className="flex gap-3 justify-end mt-1">
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
            <Input id="edit-first" label={s.firstName} value={editForm.first_name} onChange={e => setEditForm(v => ({ ...v, first_name: e.target.value }))} />
            <Input id="edit-last" label={s.lastName} value={editForm.last_name} onChange={e => setEditForm(v => ({ ...v, last_name: e.target.value }))} />
            <div className="col-span-1 sm:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-medium text-label">{t.common.email}</label>
              <input value={editUser?.email ?? ''} disabled
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed" />
            </div>
          </div>

          {editUser?.id !== primaryAdminId ? (
            <Checkbox checked={editForm.is_admin} onChange={v => setEditForm(f => ({ ...f, is_admin: v }))} label={s.admin} />
          ) : null}

          <div className="flex items-center justify-between mt-5 pt-4 -mx-6 px-6 border-t border-gray-200">
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
