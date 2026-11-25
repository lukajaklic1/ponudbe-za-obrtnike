import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Users, MoreVertical, Upload } from 'lucide-react'
import CustomerImportModal from '../components/CustomerImportModal'
import { SortIcon } from '../components/ui/SortIcon'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { COUNTRIES } from '../lib/siPosts'
import Checkbox from '../components/ui/Checkbox'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination, { usePageSize } from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { SearchBar, FilterTabs } from '../components/ui/ListToolbar'
import { FilterSelect } from '../components/ui/FilterSelect'
import type { Customer } from '../types/database'

type CustomerType = Customer['customer_type']

interface Form {
  customer_type: CustomerType
  first_name: string; last_name: string
  name: string; vat_number: string
  email: string; phone: string
  address_street: string; address_postal_code: string; address_city: string; country: string
  notes: string; status: 'active' | 'inactive'
}
const empty: Form = {
  customer_type: 'person', first_name: '', last_name: '', name: '', vat_number: '',
  email: '', phone: '', address_street: '', address_postal_code: '', address_city: '', country: 'SI', notes: '', status: 'active',
}

// Older rows may predate customer_type / first_name — derive sensibly.
function typeOf(c: Customer): CustomerType {
  return c.customer_type ?? (c.vat_number ? 'company' : 'person')
}


/** light grey examples inside the fields */
const PH = {
  sl: { first: 'Janez', last: 'Novak', company: 'Gradnje Novak d.o.o.', vat: 'SI12345678', email: 'janez.novak@gmail.com', phone: '041 123 456', street: 'Slovenska cesta 12', postal: '1000', city: 'Ljubljana' },
  en: { first: 'John', last: 'Smith', company: 'Smith Builders Ltd', vat: 'SI12345678', email: 'john.smith@gmail.com', phone: '041 123 456', street: 'Main Street 12', postal: '1000', city: 'Ljubljana' },
}
export default function CustomersPage() {
  const { company, hasPerm, isAdmin, loading: permLoading } = useCompany()
  const canEdit = hasPerm('customers', 'create')
  const { t, lang } = useLanguage()
  const ph = PH[lang === 'en' ? 'en' : 'sl']
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
  const [importOpen, setImportOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize('customers')
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
      address_street: c.address_street ?? '', address_postal_code: c.address_postal_code ?? '', address_city: c.address_city ?? '', country: c.country ?? 'SI',
      notes: c.notes ?? '', status: c.status ?? 'active',
    })
    setOpen(true)
  }

  const isPerson = form.customer_type === 'person'
  const displayName = isPerson ? `${form.first_name.trim()} ${form.last_name.trim()}`.trim() : form.name.trim()
  const canSave = (isPerson ? !!(form.first_name.trim() && form.last_name.trim()) : !!form.name.trim()) && !!form.email.trim()

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
      address_street: tr(form.address_street), address_postal_code: tr(form.address_postal_code), address_city: tr(form.address_city), country: form.country || 'SI',
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
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize)

  const field = (key: keyof Form) => ({ value: form[key] as string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value })) })

  if (!permLoading && !hasPerm('customers', 'view')) return <Navigate to="/dashboard" replace />

  return (
    <div>
      <PageHeader title={s.customers} icon={Users} action={canEdit && <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setImportOpen(true)} className="gap-2"><Upload className="w-4 h-4" />{o.importServices}</Button>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />{s.newCustomer}</Button>
      </div>} />
      <div className="px-6 py-5">

      <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder={t.common.search} />
      <FilterTabs<typeof statusFilter>
        tabs={[
          { key: 'all', label: t.common.all, count: rows.length },
          { key: 'active', label: t.common.activeFPl, count: rows.filter(c => (c.status ?? 'active') === 'active').length },
          { key: 'inactive', label: t.common.inactiveFPl, count: rows.filter(c => (c.status ?? 'active') === 'inactive').length },
        ]}
        active={statusFilter}
        onChange={k => { setStatusFilter(k); setPage(1) }}
        right={
        <FilterSelect label={o.customerType} value={typeFilter} allLabel={t.common.all}
          options={[{ value: 'person', label: o.typePerson }, { value: 'company', label: o.typeCompany }]}
          onChange={v => { setTypeFilter(v as '' | CustomerType); setPage(1) }} />} />

      <div className="table-frame">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Users className="w-10 h-10 text-[#e8eef7] mb-3" />
            <p className="text-sm text-[#667085]">{s.noCustomers}</p>
          </div>
        ) : (
          <>
          {/* phones: one card per customer instead of the wide table */}
          <div className="sm:hidden divide-y divide-[#e4e9f2]">
            {paginated.map(c => (
              <button key={c.id} type="button" onClick={() => canEdit && openEdit(c)} className="w-full text-left px-4 py-3.5 hover:bg-[#f6f8fc] transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold text-black truncate">{c.name}</span>
                  <span className="shrink-0 text-[13px] font-medium text-[#667085]">{typeOf(c) === 'company' ? o.typeCompany : o.typePerson}</span>
                </div>
                <div className="text-[13px] font-medium text-[#667085] truncate mt-0.5">{[c.email, c.phone].filter(Boolean).join(' · ') || '—'}</div>
                <div className="flex items-center justify-between gap-2 mt-1 text-[13px] font-medium text-[#667085]">
                  <span>{c.address_city ?? ''}</span>
                  <span>{s.quotesCount}: {counts[c.id] ?? 0}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto"><table className="w-full text-sm font-medium min-w-[820px]">
            <thead><tr>
              {([['name', o.customer], ['type', o.customerType], ['', t.common.email], ['', t.common.phone], ['city', o.city], ['quotes', s.quotesCount], ['status', t.common.status], ['', s.updatedAt], ['', '']] as [string, string][]).map(([key, h], i) => (
                <th key={i} className={`text-left px-4 py-3 text-xs font-medium text-[#667085] whitespace-nowrap ${key ? 'cursor-pointer select-none hover:text-black' : ''}`}
                  onClick={() => key && handleSort(key as typeof sortKey)}>
                  <span className="inline-flex items-center gap-0.5">{h}{key && <SortIcon active={sortKey === key} dir={sortDir} />}</span>
                </th>
              ))}
            </tr></thead>
            <tbody>
              {paginated.map(c => {
                const company = typeOf(c) === 'company'
                return (
                  <tr key={c.id} className={`hover:bg-[#f6f8fc] transition-colors ${canEdit ? 'cursor-pointer' : ''}`} onClick={() => canEdit && openEdit(c)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-black">{c.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#667085] whitespace-nowrap">{company ? o.typeCompany : o.typePerson}</td>
                    <td className="px-4 py-3 text-[#667085] whitespace-nowrap">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-[#667085] whitespace-nowrap">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-[#667085] whitespace-nowrap">{c.address_city ?? '—'}</td>
                    <td className="px-4 py-3 text-[#667085] whitespace-nowrap">{counts[c.id] ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium" style={(c.status ?? 'active') === 'active' ? { backgroundColor: '#e8eef7', color: '#000000' } : { backgroundColor: '#f6f8fc', color: '#667085' }}>
                        {(c.status ?? 'active') === 'active' ? t.common.activeF : t.common.inactiveF}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[#667085] whitespace-nowrap">{format(new Date(c.updated_at), 'd. M. yyyy')}</span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end">
                        {canEdit && <button onClick={() => openEdit(c)} className="p-1.5 text-[#667085] hover:text-black hover:bg-[#e8eef7] rounded-lg"><MoreVertical className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
          </>
        )}
      </div>

      <Pagination total={filtered.length} page={page} pageSize={pageSize} onChange={setPage} onPageSizeChange={setPageSize} />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? s.editCustomer : s.newCustomer} size="lg">
        <div className="flex flex-col gap-4">
          {/* Person / company switch */}
          <div className="inline-flex self-start h-10 items-stretch gap-0.5 p-[3px] rounded-[11px] bg-[#f1f1f1]">
            {([['person', o.typePerson], ['company', o.typeCompany]] as [CustomerType, string][]).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setForm(f => ({ ...f, customer_type: v }))}
                className={`px-4 rounded-[8px] text-[15px] font-medium transition-colors ${form.customer_type === v ? 'bg-white text-black shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-[#667085] hover:text-black'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isPerson ? <>
              <Input id="c-first" label={t.settings.firstName} requiredMark placeholder={ph.first} {...field('first_name')} />
              <Input id="c-last" label={t.settings.lastName} requiredMark placeholder={ph.last} {...field('last_name')} />
            </> : <>
              <Input id="c-name" label={o.companyName} requiredMark placeholder={ph.company} {...field('name')} />
              <Input id="c-vat" label={s.vatNumber} placeholder={ph.vat} {...field('vat_number')} />
              <Input id="c-first" label={o.contactFirstName} placeholder={ph.first} {...field('first_name')} />
              <Input id="c-last" label={o.contactLastName} placeholder={ph.last} {...field('last_name')} />
            </>}
            <Input id="c-email" label={t.common.email} type="email" requiredMark placeholder={ph.email} {...field('email')} />
            <Input id="c-phone" label={t.common.phone} placeholder={ph.phone} {...field('phone')} />
            <div className="sm:col-span-2"><Input id="c-street" label={o.street} placeholder={ph.street} {...field('address_street')} /></div>
            <Input id="c-postal" label={t.common.postalCode} placeholder={ph.postal} {...field('address_postal_code')} />
            <Input id="c-city" label={o.city} placeholder={ph.city} {...field('address_city')} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: '#667085' }}>{lang === 'en' ? 'Country' : 'Država'}</label>
              <Select value={form.country} onChange={v => setForm(f => ({ ...f, country: v }))} options={COUNTRIES.map(c => ({ value: c.code, label: c[lang === 'en' ? 'en' : 'sl'] }))} />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label htmlFor="c-notes" className="text-xs font-medium" style={{ color: '#667085' }}>{o.customerNotes}</label>
              <textarea id="c-notes" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={o.customerNotesHint}
                className="rounded-lg border border-[#e4e9f2] px-3 py-2 text-sm text-black placeholder-[#667085] hover:border-[#667085] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>

          <Checkbox checked={form.status === 'active'} onChange={v => setForm(f => ({ ...f, status: v ? 'active' : 'inactive' }))} label={t.common.activeF} />
        </div>

        {editing && (counts[editing.id] ?? 0) > 0 && <p className="text-sm text-[#667085] mt-5">{s.cannotDeleteLinkedCustomer}</p>}
        <div className="flex items-center justify-between mt-5 pt-4 -mx-6 px-6 border-t border-[#e4e9f2]">
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

      {company && <CustomerImportModal open={importOpen} onClose={() => setImportOpen(false)} companyId={company.id}
        lang={lang} typeLabels={{ person: o.typePerson, company: o.typeCompany }} onDone={load} />}

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={doDelete}
        title={s.deleteCustomer} message={s.deleteCustomerConfirm} confirmLabel={t.common.delete} danger loading={deleting} />
    </div>
    </div>
  )
}
