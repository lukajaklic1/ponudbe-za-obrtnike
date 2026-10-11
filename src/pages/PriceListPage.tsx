import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Tags, Tag, Search, CalendarDays, MoreVertical, Upload } from 'lucide-react'
import PriceImportModal from '../components/PriceImportModal'
import { SortIcon } from '../components/ui/SortIcon'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import NumberInput from '../components/ui/NumberInput'
import Checkbox from '../components/ui/Checkbox'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterSelect } from '../components/ui/FilterSelect'
import { PersonBadge } from '../components/ui/PersonBadge'
import type { PriceItem, PriceUnit } from '../types/database'

const PAGE_SIZE = 20
export const PRICE_UNITS: PriceUnit[] = ['m2', 'm', 'pcs', 'h', 'lump', 'l', 'kg']
export const VAT_RATES = [22, 9.5, 0]

interface Form { code: string; name: string; description: string; unit: PriceUnit; price: number | null; vat_rate: number; is_active: boolean }
const empty: Form = { code: '', name: '', description: '', unit: 'm2', price: null, vat_rate: 22, is_active: true }

export default function PriceListPage() {
  const { company, hasPerm, isAdmin, loading: permLoading } = useCompany()
  const canEdit = hasPerm('price_list', 'create')
  const { t, lang } = useLanguage()
  const o = t.od
  type Row = PriceItem & { editor: { first_name: string; last_name: string } | null }
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PriceItem | null>(null)
  const [form, setForm] = useState<Form>(empty)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<PriceItem | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [used, setUsed] = useState<Set<string>>(new Set()) // services on any quote → deactivate only, no delete
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortKey, setSortKey] = useState<'code' | 'name' | 'unit' | 'price' | 'vat_rate' | 'is_active' | 'updated_at'>('code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  function handleSort(k: typeof sortKey) { setSortKey(k); setSortDir(d => k === sortKey ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); setPage(1) }

  useEffect(() => { if (company) load() }, [company])
  async function load() {
    if (!company) return
    // spinner only on first load (initial state) — reloads keep the current view on screen
    const [{ data: items }, { data: companyUsers }, { data: lineRefs }] = await Promise.all([
      supabase.from('price_items').select('*').eq('company_id', company.id).order('code'),
      supabase.from('users').select('id, first_name, last_name').eq('company_id', company.id),
      supabase.from('quote_lines').select('price_item_id').eq('company_id', company.id).not('price_item_id', 'is', null),
    ])
    setUsed(new Set(((lineRefs ?? []) as { price_item_id: string }[]).map(l => l.price_item_id)))
    const userMap: Record<string, { first_name: string; last_name: string }> = {}
    for (const u of companyUsers ?? []) userMap[u.id] = { first_name: u.first_name, last_name: u.last_name }
    setRows(((items ?? []) as PriceItem[]).map(p => ({ ...p, editor: userMap[p.updated_by ?? p.created_by ?? ''] ?? null })))
    setLoading(false)
  }

  function openNew() { setEditing(null); setForm(empty); setOpen(true) }
  function openEdit(p: PriceItem) {
    setEditing(p)
    setForm({ code: p.code ?? '', name: p.name, description: p.description ?? '', unit: p.unit, price: p.price, vat_rate: Number(p.vat_rate), is_active: p.is_active })
    setOpen(true)
  }
  async function save() {
    if (!company || !form.name.trim()) return
    setSaving(true)
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null
    const payload = {
      code: form.code.trim() || null, name: form.name.trim(), description: form.description.trim() || null,
      unit: form.unit, price: form.price ?? 0,
      vat_rate: form.vat_rate, is_active: form.is_active,
    }
    const { error } = editing
      ? await supabase.from('price_items').update({ ...payload, updated_at: new Date().toISOString(), updated_by: uid }).eq('id', editing.id)
      : await supabase.from('price_items').insert({ ...payload, company_id: company.id, created_by: uid, updated_by: null })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(t.common.saved); setOpen(false); load()
  }
  async function doDelete() {
    if (!toDelete) return
    if (used.has(toDelete.id)) { toast.error(o.cannotDeleteUsedService); setToDelete(null); return }
    const { error } = await supabase.from('price_items').delete().eq('id', toDelete.id)
    if (error) { toast.error(error.message); return }
    toast.success(t.common.deleted); setToDelete(null); load()
  }

  const cur = company?.currency ?? 'EUR'
  const money = (n: number) => Number(n).toLocaleString('de-DE', { style: 'currency', currency: cur })
  const q = search.toLowerCase()
  const filtered = rows.filter(p =>
    (!search || p.name.toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q)) &&
    (statusFilter === 'all' || (statusFilter === 'active' ? p.is_active : !p.is_active))
  )
  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'price') return (Number(a.price) - Number(b.price)) * mul
    if (sortKey === 'vat_rate') return (Number(a.vat_rate) - Number(b.vat_rate)) * mul
    if (sortKey === 'is_active') return (Number(b.is_active) - Number(a.is_active)) * mul
    const av = String(a[sortKey] ?? ''), bv = String(b[sortKey] ?? '')
    return av.localeCompare(bv, undefined, { numeric: true }) * mul
  })
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (!permLoading && !hasPerm('price_list', 'view')) return <Navigate to="/dashboard" replace />

  return (
    <div>
      <PageHeader title={o.priceList} icon={Tags} count={rows.length} action={canEdit && <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setImportOpen(true)} className="gap-2"><Upload className="w-4 h-4" />{o.importServices}</Button>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />{o.newPriceItem}</Button>
      </div>} />
      <div className="p-4">

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-900 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t.common.search}
            className="pl-9 pr-3 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56" />
        </div>
        <FilterSelect label={t.common.status} value={statusFilter === 'all' ? '' : statusFilter} allLabel={t.common.all}
          options={[{ value: 'active', label: t.common.activeFPl }, { value: 'inactive', label: t.common.inactiveFPl }]}
          onChange={v => { setStatusFilter((v || 'all') as typeof statusFilter); setPage(1) }} />
      </div>

      <div className="-mx-4 border-t border-b border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <Tags className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">{o.noPriceItems}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center"><Tags className="w-9 h-9 text-gray-200 mb-2" /><p className="text-sm text-gray-400">{o.noPriceItems}</p></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[760px]">
            <thead className="bg-gray-50 border-b border-gray-200"><tr>
              {([['code', o.code], ['name', o.itemName], ['unit', o.unit], ['price', o.priceNet], ['vat_rate', o.vat], ['is_active', t.common.status], ['updated_at', o.updatedAt], ['', '']] as [string, string][]).map(([key, h], i) => (
                <th key={i} className={`text-left px-4 py-2.5 text-xs font-medium text-gray-500 ${key ? 'cursor-pointer select-none hover:text-gray-700' : ''}`}
                  onClick={() => key && handleSort(key as typeof sortKey)}>
                  <span className="inline-flex items-center gap-0.5">{h}{key && <SortIcon active={sortKey === key} dir={sortDir} />}</span>
                </th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {paginated.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 ${canEdit ? 'cursor-pointer' : ''}`} onClick={() => canEdit && openEdit(p)}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#e5eeff', border: '1px solid #d6e5ff' }}>
                        <Tag className="w-3.5 h-3.5" style={{ color: '#215bcf' }} />
                      </div>
                      <span className="text-gray-700">{p.code || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900">{p.name}</div>
                    {p.description && <div className="text-xs text-gray-400 truncate max-w-xs">{p.description}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{o.units[p.unit]}</td>
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{money(p.price)}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{Number(p.vat_rate).toLocaleString('de-DE')} %</td>
                  <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-md text-xs font-medium" style={p.is_active ? { backgroundColor: '#e0fced', border: '1px solid #d4f8e6', color: '#098259' } : { backgroundColor: '#f5f5f5', border: '1px solid #e5e7eb', color: '#6b7280' }}>{p.is_active ? t.common.activeF : t.common.inactiveF}</span></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-200 text-xs text-gray-900 whitespace-nowrap" style={{ backgroundColor: '#fbfbfb' }}><CalendarDays className="w-3 h-3 text-gray-500 shrink-0" />{format(new Date(p.updated_at ?? p.created_at), 'd. M. yyyy')}</span>
                      {p.editor && <PersonBadge name={`${p.editor.first_name} ${p.editor.last_name}`} />}
                    </div>
                  </td>
                  <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end">
                      {canEdit && <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><MoreVertical className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? o.editPriceItem : o.newPriceItem} size="md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input id="pi-code" label={o.code} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
          <div className="sm:col-span-2"><Input id="pi-name" label={o.itemName} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="sm:col-span-3 flex flex-col gap-1">
            <label className="text-sm font-medium text-label">{o.description}</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-label">{o.unit}</label>
            <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value as PriceUnit }))}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {PRICE_UNITS.map(u => <option key={u} value={u}>{o.units[u]}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-label">{o.vat}</label>
            <select value={form.vat_rate} onChange={e => setForm(f => ({ ...f, vat_rate: Number(e.target.value) }))}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {VAT_RATES.map(v => <option key={v} value={v}>{v.toLocaleString('de-DE')} %</option>)}
            </select>
          </div>
          <div>
            <NumberInput label={o.priceNet} unit={`€ / ${o.units[form.unit]}`} value={form.price} onValue={v => setForm(f => ({ ...f, price: v }))} />
          </div>
        </div>
        <div className="mt-4"><Checkbox checked={form.is_active} onChange={v => setForm(f => ({ ...f, is_active: v }))} label={t.common.activeF} /></div>
        {editing && used.has(editing.id) && <p className="text-sm text-gray-400 mt-5">{o.cannotDeleteUsedService}</p>}
        <div className="flex items-center justify-between mt-4 pt-4 -mx-6 px-6 border-t border-gray-200">
          <div>
            {editing && isAdmin && !used.has(editing.id) && (
              <Button variant="danger" onClick={() => { setOpen(false); setToDelete(editing) }}>{t.common.delete}</Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
            <Button loading={saving} onClick={save} disabled={!form.name.trim()}>{t.common.save}</Button>
          </div>
        </div>
      </Modal>

      {company && <PriceImportModal open={importOpen} onClose={() => setImportOpen(false)} companyId={company.id}
        lang={lang} units={o.units} money={money} onDone={load} />}

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={doDelete}
        title={o.deletePriceItem} message={o.deletePriceItemConfirm} confirmLabel={t.common.delete} danger />
    </div>
    </div>
  )
}
