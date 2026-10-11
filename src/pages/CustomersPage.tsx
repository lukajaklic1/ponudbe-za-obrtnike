import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Users, Search, CalendarDays, Building2, User, MoreVertical } from 'lucide-react'
import { SortIcon } from '../components/ui/SortIcon'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Checkbox from '../components/ui/Checkbox'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterSelect } from '../components/ui/FilterSelect'
import type { Customer } from '../types/database'

type CustomerType = Customer['customer_type']

interface Form {
  customer_type: CustomerType
  first_name: string; last_name: string
  name: string; vat_number: string
  email: string; phone: string
  address_street: string; address_postal_code: string; address_city: string
  notes: string; status: 'active' | 'inactive'
}
const empty: Form = {
  customer_type: 'person', first_name: '', last_name: '', name: '', vat_number: '',
  email: '', phone: '', address_street: '', address_postal_code: '', address_city: '', notes: '', status: 'active',
}

// Older rows may predate customer_type / first_name — derive sensibly.
function typeOf(c: Customer): CustomerType {
  return c.customer_type ?? (c.vat_number ? 'company' : 'person')
}

const PAGE_SIZE = 20

export default function CustomersPage() {
  const { company, hasPerm, isAdmin, loading: permLoading } = useCompany()
  const canEdit = hasPerm('customers', 'create')
  const { t } = useLanguage()
  const s = t.qp
  const o = t.od
  const [rows, setRows] = useState<Customer[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [typeFilter, setTypeFilter] = useState<'' | CustomerType>('')

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<Form>(empty)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<'created' | 'name' | 'type' | 'city' | 'status' | 'quotes'>('created')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc') // default: newest first
  function handleSort(k: typeof sortKey) { setSortKey(k); setSortDir(d => k === sortKey ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); setPage(1) }

  useEffect(() => { if (company) load() }, [company])

  async function load() {
    if (!company) return
    // spinner only on first load (initial state) — reloads keep the current view on screen
    const [{ data: custData }, { data: quoteData }] = await Promise.all([
      supabase.from('customers').select('*').eq('company_id', company.id).order('name'),
      supabase.from('quotes').select('customer_id').eq('company_id', company.id),
    ])
    setRows((custData as Customer[]) ?? [])
    const c: Record<string, number> = {}
    for (const q of (quoteData as { customer_id: string }[]) ?? []) c[q.customer_id] = (c[q.customer_id] ?? 0) + 1
    setCounts(c)
    setLoading(false)
  }

  function openNew() { setEditing(null); setForm(empty); setOpen(true) }
  function openEdit(c: Customer) {
    const type = typeOf(c)
    // person without split name (old data): first word = first name, rest = last name
    const [fn, ...ln] = ((type === 'person' ? c.name : c.contact_person) ?? '').split(' ')
    setEditing(c)
    setForm({
      customer_type: type,
      first_name: c.first_name ?? fn,
      last_name: c.last_name ?? ln.join(' '),
      name: type === 'company' ? c.name : '',
      vat_number: c.vat_number ?? '',
      email: c.email ?? '', phone: c.phone ?? '',
      address_street: c.address_street ?? '', address_postal_code: c.address_postal_code ?? '', address_city: c.address_city ?? '',
      notes: c.notes ?? '', status: c.status ?? 'active',
    })
    setOpen(true)
  }

  const isPerson = form.customer_type === 'person'
  const displayName = isPerson ? `${form.first_name.trim()} ${form.last_name.trim()}`.trim() : form.name.trim()
  const canSave = isPerson ? !!(form.first_name.trim() && form.last_name.trim()) : !!form.name.trim()

  async function save() {
    if (!company || !canSave) return
    setSaving(true)
    const tr = (v: string) => v.trim() || null
    const payload = {
      customer_type: form.customer_type, name: displayName,
      first_name: tr(form.first_name),
      last_name: tr(form.last_name),
      vat_number: isPerson ? null : tr(form.vat_number),
      contact_person: isPerson ? null : tr(`${form.first_name.trim()} ${form.last_name.trim()}`),
      email: tr(form.email), phone: tr(form.phone),
      address_street: tr(form.address_street), address_postal_code: tr(form.address_postal_code), address_city: tr(form.address_city),
      notes: tr(form.notes), status: form.status,
    }
    const { error } = editing
      ? await supabase.from('customers').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      : await supabase.from('customers').insert({ ...payload, company_id: company.id } as any)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(t.common.saved); setOpen(false); load()
  }

  async function doDelete() {
    if (!toDelete) return
    setDeleting(true)
    if ((counts[toDelete.id] ?? 0) > 0) { setDeleting(false); toast.error(s.cannotDeleteLinkedCustomer); setToDelete(null); return }
    const { error } = await supabase.from('customers').delete().eq('id', toDelete.id)
    setDeleting(false)
    if (error) { toast.error(error.message); return }
    toast.success(t.common.deleted); setToDelete(null); load()
  }

  const q = search.toLowerCase()
  const filtered = rows.filter(c =>
    (statusFilter === 'all' || (c.status ?? 'active') === statusFilter) &&
    (!typeFilter || typeOf(c) === typeFilter) &&
    (!search || [c.name, c.contact_person, c.email, c.phone, c.address_city].some(v => (v ?? '').toLowerCase().includes(q))))
  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'created') return a.created_at.localeCompare(b.created_at) * mul
    if (sortKey === 'name') return a.name.localeCompare(b.name) * mul
    if (sortKey === 'type') return typeOf(a).localeCompare(typeOf(b)) * mul
    if (sortKey === 'city') return (a.address_city ?? '').localeCompare(b.address_city ?? '') * mul
    if (sortKey === 'status') return ((a.status ?? 'active') > (b.status ?? 'active') ? 1 : -1) * mul
    if (sortKey === 'quotes') return ((counts[a.id] ?? 0) - (counts[b.id] ?? 0)) * mul
    return 0
  })
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const field = (key: keyof Form) => ({ value: form[key] as string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value })) })

  if (!permLoading && !hasPerm('customers', 'view')) return <Navigate to="/dashboard" replace />

  return (
    <div>
      <PageHeader title={s.customers} icon={Users} count={rows.length} action={canEdit && <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />{s.newCustomer}</Button>} />
      <div className="p-4">

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-gray-900 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t.common.search}
            className="w-full pl-9 pr-3 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <FilterSelect label={o.customerType} value={typeFilter} allLabel={t.common.all}
          options={[{ value: 'person', label: o.typePerson }, { value: 'company', label: o.typeCompany }]}
          onChange={v => { setTypeFilter(v as '' | CustomerType); setPage(1) }} />
        <FilterSelect label={t.common.status} value={statusFilter === 'all' ? '' : statusFilter} allLabel={t.common.all}
          options={[{ value: 'active', label: t.common.activeFPl }, { value: 'inactive', label: t.common.inactiveFPl }]}
          onChange={v => { setStatusFilter((v || 'all') as typeof statusFilter); setPage(1) }} />
      </div>

      <div className="-mx-4 border-t border-b border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Users className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">{s.noCustomers}</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[820px]">
            <thead className="bg-gray-50 border-b border-gray-200"><tr>
              {([['name', o.customer], ['type', o.customerType], ['', t.common.email], ['', t.common.phone], ['city', o.city], ['quotes', s.quotesCount], ['status', t.common.status], ['', s.updatedAt], ['', '']] as [string, string][]).map(([key, h], i) => (
                <th key={i} className={`text-left px-4 py-3 text-xs font-medium text-gray-500 ${key ? 'cursor-pointer select-none hover:text-gray-700' : ''}`}
                  onClick={() => key && handleSort(key as typeof sortKey)}>
                  <span className="inline-flex items-center gap-0.5">{h}{key && <SortIcon active={sortKey === key} dir={sortDir} />}</span>
                </th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {paginated.map(c => {
                const company = typeOf(c) === 'company'
                const Icon = company ? Building2 : User
                return (
                  <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${canEdit ? 'cursor-pointer' : ''}`} onClick={() => canEdit && openEdit(c)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#e5eeff', border: '1px solid #d6e5ff' }}>
                          <Icon className="w-3.5 h-3.5" style={{ color: '#215bcf' }} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">{c.name}</div>
                          {company && c.contact_person && <div className="text-xs text-gray-400">{c.contact_person}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{company ? o.typeCompany : o.typePerson}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.address_city ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{counts[c.id] ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={(c.status ?? 'active') === 'active' ? { backgroundColor: '#e0fced', border: '1px solid #d4f8e6', color: '#098259' } : { backgroundColor: '#f5f5f5', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                        {(c.status ?? 'active') === 'active' ? t.common.activeF : t.common.inactiveF}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-200 text-xs text-gray-900 whitespace-nowrap" style={{ backgroundColor: '#fbfbfb' }}><CalendarDays className="w-3 h-3 text-gray-500 shrink-0" />{format(new Date(c.updated_at), 'd. M. yyyy')}</span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end">
                        {canEdit && <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><MoreVertical className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </div>

      <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? s.editCustomer : s.newCustomer} size="lg">
        <div className="flex flex-col gap-4">
          {/* Person / company switch */}
          <div className="inline-flex self-start rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {([['person', o.typePerson], ['company', o.typeCompany]] as [CustomerType, string][]).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setForm(f => ({ ...f, customer_type: v }))}
                className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${form.customer_type === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isPerson ? <>
              <Input id="c-first" label={t.settings.firstName} {...field('first_name')} />
              <Input id="c-last" label={t.settings.lastName} {...field('last_name')} />
            </> : <>
              <Input id="c-name" label={o.companyName} {...field('name')} />
              <Input id="c-vat" label={s.vatNumber} {...field('vat_number')} />
              <Input id="c-first" label={o.contactFirstName} {...field('first_name')} />
              <Input id="c-last" label={o.contactLastName} {...field('last_name')} />
            </>}
            <Input id="c-email" label={t.common.email} type="email" {...field('email')} />
            <Input id="c-phone" label={t.common.phone} {...field('phone')} />
            <div className="sm:col-span-2"><Input id="c-street" label={o.street} {...field('address_street')} /></div>
            <Input id="c-postal" label={t.common.postalCode} {...field('address_postal_code')} />
            <Input id="c-city" label={o.city} {...field('address_city')} />
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label htmlFor="c-notes" className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{o.customerNotes}</label>
              <textarea id="c-notes" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={o.customerNotesHint}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>

          <Checkbox checked={form.status === 'active'} onChange={v => setForm(f => ({ ...f, status: v ? 'active' : 'inactive' }))} label={t.common.activeF} />
        </div>

        {editing && (counts[editing.id] ?? 0) > 0 && <p className="text-sm text-gray-400 mt-5">{s.cannotDeleteLinkedCustomer}</p>}
        <div className="flex items-center justify-between mt-5 pt-4 -mx-6 px-6 border-t border-gray-200">
          <div>
            {editing && isAdmin && (counts[editing.id] ?? 0) === 0 && (
              <Button variant="danger" onClick={() => { setOpen(false); setToDelete(editing) }}>{t.common.delete}</Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
            <Button loading={saving} onClick={save} disabled={!canSave}>{editing ? t.common.save : s.newCustomer}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={doDelete}
        title={s.deleteCustomer} message={s.deleteCustomerConfirm} confirmLabel={t.common.delete} danger loading={deleting} />
    </div>
    </div>
  )
}
