import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AppWindow, Plus, Pencil, Trash2, Sparkles, ExternalLink, Copy, ClipboardPaste } from 'lucide-react'
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
import { PageHeader } from '../components/ui/PageHeader'
import WindowDrawing from '../components/WindowDrawing'
import { cn } from '../lib/cn'
import {
  TEMPLATES, MATERIALS, OPTION_GROUPS, SERVICE_GROUPS, EXTRA_PRICING, SERVICE_PRICING, STARTER, WL, money, parseMatrix, basePrice,
  type WindowSystem, type WindowType, type WindowPrice, type WindowOption, type PriceMatrix,
  type WindowMaterial, type WindowTemplate, type OptionGroup, type OptionPricing,
} from '../lib/windows'

type Tab = 'systems' | 'types' | 'prices' | 'options' | 'services' | 'configurator'

const TXT = {
  sl: {
    title: 'Cenik',
    tabs: { systems: 'Profilni sistemi', types: 'Tipi oken', prices: 'Cene oken', options: 'Dodatki', services: 'Storitve', configurator: 'Spletni konfigurator' } as Record<Tab, string>,
    extrasHint: 'Dodatki spremenijo okno (steklo, barva, kljuka, police, senčila). Cena se prišteje k ceni okna, glede na mere okna.',
    servicesHint: 'Storitve se izberejo enkrat za celo ponudbo in so v ponudbi svoja postavka. Količina se izračuna iz vseh oken: kos = število oken, tm obsega = 2 × (širina + višina), tm širine = širina okna, m² = površina, pavšal = enkrat na ponudbo.',
    add: 'Dodaj', edit: 'Uredi', name: 'Naziv', material: 'Material', description: 'Opis', active: 'Aktivno', inactive: 'Neaktivno',
    template: 'Oblika', minW: 'Min. širina', maxW: 'Maks. širina', minH: 'Min. višina', maxH: 'Maks. višina',
    group: 'Skupina', pricing: 'Obračun', price: 'Cena', isDefault: 'Privzeta izbira', dflt: 'privzeto',
    empty: 'Katalog je prazen.', emptyHint: 'Dodaj sisteme, tipe oken in cene ali naloži primer kataloga in ga prilagodi.',
    loadStarter: 'Naloži primer kataloga', starterDone: 'Primer kataloga je naložen',
    system: 'Sistem', type: 'Tip okna', perM2: 'Cena na m²', minPrice: 'Min. cena', matrix: 'Cenovna matrika (širina × višina, mm)',
    matrixHint: 'Cena se vzame iz prve celice, kjer sta širina in višina ≥ izmeri. Če okno pade izven matrike ali je celica prazna, se uporabi cena na m² (vsaj min. cena).',
    paste: 'Prilepi iz Excela', pasteHint: 'Prva vrstica: prazna celica, nato širine. Vsaka naslednja vrstica: višina, nato cene.',
    apply: 'Uporabi', invalidPaste: 'Tabele ni bilo mogoče prebrati', addCol: '+ širina', addRow: '+ višina', clear: 'Počisti matriko',
    notPriced: 'brez cene', priced: 'cena nastavljena', test: 'Preizkus cene', width: 'Širina', height: 'Višina',
    delete: 'Izbriši', deleteConfirm: 'Res želiš izbrisati', save: 'Shrani',
    cfgEnabled: 'Konfigurator je javno dostopen', cfgSlug: 'Naslov strani', cfgShowPrices: 'Stranka vidi cene sproti',
    cfgAccent: 'Barva gumbov', cfgIntro: 'Uvodno besedilo', cfgLink: 'Povezava za tvojo spletno stran', copy: 'Kopiraj', copied: 'Kopirano',
    open: 'Odpri', embed: 'Vstavi v spletno stran (iframe)', slugInvalid: 'Naslov: 3–40 znakov, male črke, številke in vezaji',
    slugTaken: 'Ta naslov je že zaseden', none: '—',
  },
  en: {
    title: 'Price list',
    tabs: { systems: 'Profile systems', types: 'Window types', prices: 'Window prices', options: 'Extras', services: 'Services', configurator: 'Online configurator' } as Record<Tab, string>,
    extrasHint: 'Extras change the window (glass, colour, handle, sills, shading). Their price is added to the window price, based on its size.',
    servicesHint: 'Services are chosen once per quote and get their own quote line. Quantity comes from all windows: piece = number of windows, m of perimeter = 2 × (width + height), m of width = window width, m² = area, flat = once per quote.',
    add: 'Add', edit: 'Edit', name: 'Name', material: 'Material', description: 'Description', active: 'Active', inactive: 'Inactive',
    template: 'Layout', minW: 'Min. width', maxW: 'Max. width', minH: 'Min. height', maxH: 'Max. height',
    group: 'Group', pricing: 'Pricing', price: 'Price', isDefault: 'Default choice', dflt: 'default',
    empty: 'The catalog is empty.', emptyHint: 'Add systems, window types and prices, or load a sample catalog and adjust it.',
    loadStarter: 'Load sample catalog', starterDone: 'Sample catalog loaded',
    system: 'System', type: 'Window type', perM2: 'Price per m²', minPrice: 'Min. price', matrix: 'Price matrix (width × height, mm)',
    matrixHint: 'The price is taken from the first cell where width and height are ≥ the measurement. Outside the matrix or on an empty cell the price per m² is used (at least the min. price).',
    paste: 'Paste from Excel', pasteHint: 'First row: empty cell, then widths. Every next row: height, then prices.',
    apply: 'Apply', invalidPaste: 'Could not read the table', addCol: '+ width', addRow: '+ height', clear: 'Clear matrix',
    notPriced: 'no price', priced: 'priced', test: 'Price check', width: 'Width', height: 'Height',
    delete: 'Delete', deleteConfirm: 'Do you really want to delete', save: 'Save',
    cfgEnabled: 'Configurator is publicly available', cfgSlug: 'Page address', cfgShowPrices: 'Customer sees prices live',
    cfgAccent: 'Button colour', cfgIntro: 'Intro text', cfgLink: 'Link for your website', copy: 'Copy', copied: 'Copied',
    open: 'Open', embed: 'Embed in your website (iframe)', slugInvalid: 'Address: 3–40 chars, lowercase letters, digits and dashes',
    slugTaken: 'This address is already taken', none: '—',
  },
}

const EMPTY_MATRIX: PriceMatrix = { widths: [], heights: [], prices: [] }

export default function WindowCatalogPage() {
  const { company, hasPerm, loading: permLoading, refetch } = useCompany()
  const { lang } = useLanguage()
  const T = TXT[lang]
  const L = WL[lang]
  const canEdit = hasPerm('price_list', 'create')
  const cur = company?.currency ?? 'EUR'

  const [tab, setTab] = useState<Tab>('systems')
  const [systems, setSystems] = useState<WindowSystem[]>([])
  const [types, setTypes] = useState<WindowType[]>([])
  const [prices, setPrices] = useState<WindowPrice[]>([])
  const [options, setOptions] = useState<WindowOption[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => { if (company) load() }, [company?.id])
  async function load() {
    if (!company) return
    const [s, t, p, o] = await Promise.all([
      supabase.from('window_systems' as any).select('*').eq('company_id', company.id).order('sort_order').order('name'),
      supabase.from('window_types' as any).select('*').eq('company_id', company.id).order('sort_order').order('name'),
      supabase.from('window_prices' as any).select('*').eq('company_id', company.id),
      supabase.from('window_options' as any).select('*').eq('company_id', company.id).order('group_key').order('sort_order').order('name'),
    ])
    const err = s.error || t.error || p.error || o.error
    if (err) toast.error(err.message)
    setSystems((s.data ?? []) as unknown as WindowSystem[])
    setTypes((t.data ?? []) as unknown as WindowType[])
    setPrices((p.data ?? []) as unknown as WindowPrice[])
    setOptions((o.data ?? []) as unknown as WindowOption[])
    setLoading(false)
  }

  async function loadStarter() {
    if (!company) return
    setSeeding(true)
    try {
      const { data: sys, error: e1 } = await supabase.from('window_systems' as any)
        .insert(STARTER.systems.map((s, i) => ({ ...s, company_id: company.id, sort_order: i }))).select()
      if (e1) throw e1
      const { data: typ, error: e2 } = await supabase.from('window_types' as any)
        .insert(STARTER.types.map((t, i) => ({ name: t.name, template: t.template, max_width: t.max_width, max_height: t.max_height, company_id: company.id, sort_order: i }))).select()
      if (e2) throw e2
      const rows: object[] = []
      for (const s of (sys ?? []) as unknown as WindowSystem[]) for (const t of (typ ?? []) as unknown as WindowType[]) {
        const factor = STARTER.types.find(x => x.template === t.template)?.factor ?? 1
        const perM2 = Math.round((STARTER.basePerM2[s.name] ?? 250) * factor)
        rows.push({ company_id: company.id, system_id: s.id, type_id: t.id, matrix: EMPTY_MATRIX, price_per_m2: perM2, min_price: Math.round(perM2 * 0.8) })
      }
      const { error: e3 } = await supabase.from('window_prices' as any).insert(rows)
      if (e3) throw e3
      const { error: e4 } = await supabase.from('window_options' as any)
        .insert(STARTER.options.map((o, i) => ({ ...o, company_id: company.id, sort_order: i })))
      if (e4) throw e4
      toast.success(T.starterDone)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSeeding(false)
    }
  }

  if (!permLoading && !hasPerm('price_list', 'view')) return <Navigate to="/dashboard" replace />

  const isEmpty = !loading && systems.length === 0 && types.length === 0 && options.length === 0

  return (
    <div>
      <PageHeader title={T.title} icon={AppWindow} action={canEdit && isEmpty && (
        <Button onClick={loadStarter} loading={seeding} className="gap-2"><Sparkles className="w-4 h-4" />{T.loadStarter}</Button>
      )} />

      <div className="px-4 border-b border-gray-200 bg-white flex gap-1 overflow-x-auto">
        {(Object.keys(T.tabs) as Tab[]).map(k => (
          <button key={k} onClick={() => setTab(k)}
            className={cn('px-3 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab === k ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800')}>
            {T.tabs[k]}
          </button>
        ))}
      </div>

      <div className="p-4 lg:p-6">
        {loading ? <div className="text-sm text-gray-400">…</div> : (<>
          {isEmpty && tab !== 'configurator' && <div className="max-w-md mx-auto text-center py-10">
            <AppWindow className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">{T.empty}</p>
            <p className="text-sm text-gray-500 mt-1 mb-4">{T.emptyHint}</p>
            {canEdit && <div className="flex justify-center gap-2">
              <Button onClick={loadStarter} loading={seeding} className="gap-2"><Sparkles className="w-4 h-4" />{T.loadStarter}</Button>
            </div>}
          </div>}
          <>
            {tab === 'systems' && <SystemsTab T={T} L={L} rows={systems} canEdit={canEdit} companyId={company!.id} onChange={load} />}
            {tab === 'types' && <TypesTab T={T} L={L} rows={types} canEdit={canEdit} companyId={company!.id} onChange={load} />}
            {tab === 'prices' && <PricesTab T={T} systems={systems} types={types} prices={prices} canEdit={canEdit} companyId={company!.id} currency={cur} onChange={load} />}
            {tab === 'options' && <OptionsTab T={T} L={L} rows={options} groups={OPTION_GROUPS} pricings={EXTRA_PRICING} hint={T.extrasHint} canEdit={canEdit} companyId={company!.id} currency={cur} onChange={load} />}
            {tab === 'services' && <OptionsTab T={T} L={L} rows={options} groups={SERVICE_GROUPS} pricings={SERVICE_PRICING} hint={T.servicesHint} canEdit={canEdit} companyId={company!.id} currency={cur} onChange={load} />}
            {tab === 'configurator' && company && <ConfiguratorTab T={T} canEdit={canEdit} company={company} onSaved={refetch} />}
          </>
        </>)}
      </div>
    </div>
  )
}

type TT = typeof TXT['sl']
type LL = typeof WL['sl']

// ─── Shared bits ────────────────────────────────────────────
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('bg-white border border-gray-200 rounded-lg', className)}>{children}</div>
}
function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn('px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap', className)}>{children}</th>
}
function ActiveDot({ on, T }: { on: boolean; T: TT }) {
  return <span className={cn('inline-flex items-center gap-1.5 text-xs', on ? 'text-green-700' : 'text-gray-400')}>
    <span className={cn('w-1.5 h-1.5 rounded-full', on ? 'bg-green-500' : 'bg-gray-300')} />{on ? T.active : T.inactive}
  </span>
}
function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex justify-end gap-1">
    <button onClick={onEdit} className="p-1.5 rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100"><Pencil className="w-3.5 h-3.5" /></button>
    <button onClick={onDelete} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
  </div>
}
function Select<V extends string>({ label, value, onChange, options }: { label: string; value: V; onChange: (v: V) => void; options: { value: V; label: string }[] }) {
  return <div className="flex flex-col gap-1">
    <label className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{label}</label>
    <select value={value} onChange={e => onChange(e.target.value as V)}
      className="block w-full rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
}
async function removeRow(table: string, id: string, onDone: () => void) {
  const { error } = await supabase.from(table as any).delete().eq('id', id)
  if (error) { toast.error(error.message); return }
  onDone()
}

// ─── Systems ────────────────────────────────────────────────
function SystemsTab({ T, L, rows, canEdit, companyId, onChange }: { T: TT; L: LL; rows: WindowSystem[]; canEdit: boolean; companyId: string; onChange: () => void }) {
  const [editing, setEditing] = useState<Partial<WindowSystem> | null>(null)
  const [toDelete, setToDelete] = useState<WindowSystem | null>(null)
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!editing?.name?.trim()) return
    setSaving(true)
    const payload = { name: editing.name.trim(), material: editing.material ?? 'pvc', description: editing.description?.trim() || null, is_active: editing.is_active ?? true }
    const { error } = editing.id
      ? await supabase.from('window_systems' as any).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      : await supabase.from('window_systems' as any).insert({ ...payload, company_id: companyId, sort_order: rows.length })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setEditing(null); onChange()
  }
  return <>
    <div className="flex justify-end mb-3">{canEdit && <Button size="sm" className="gap-1.5" onClick={() => setEditing({ material: 'pvc', is_active: true })}><Plus className="w-4 h-4" />{T.add}</Button>}</div>
    <Card>
      <table className="w-full text-sm font-[450]">
        <thead className="bg-gray-50 border-b border-gray-200"><tr><Th>{T.name}</Th><Th>{T.material}</Th><Th>{T.description}</Th><Th>{T.active}</Th><Th /></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id} className="border-b border-gray-200 last:border-0 hover:bg-gray-50">
          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.name}</td>
          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{L.materials[r.material]}</td>
          <td className="px-4 py-3 text-gray-500 max-w-[320px] truncate">{r.description || T.none}</td>
          <td className="px-4 py-3"><ActiveDot on={r.is_active !== false} T={T} /></td>
          <td className="px-4 py-3">{canEdit && <RowActions onEdit={() => setEditing(r)} onDelete={() => setToDelete(r)} />}</td>
        </tr>)}</tbody>
      </table>
    </Card>
    <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? T.edit : T.add}>
      {editing && <div className="space-y-3">
        <Input label={T.name} value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} autoFocus />
        <Select label={T.material} value={editing.material ?? 'pvc'} onChange={v => setEditing({ ...editing, material: v as WindowMaterial })}
          options={MATERIALS.map(m => ({ value: m, label: L.materials[m] }))} />
        <Input label={T.description} value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
        <Checkbox checked={editing.is_active ?? true} onChange={v => setEditing({ ...editing, is_active: v })} label={T.active} />
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => setEditing(null)}>✕</Button><Button onClick={save} loading={saving}>{T.save}</Button></div>
      </div>}
    </Modal>
    <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title={T.delete}
      message={`${T.deleteConfirm} „${toDelete?.name}“?`} confirmLabel={T.delete}
      onConfirm={() => toDelete && removeRow('window_systems', toDelete.id, () => { setToDelete(null); onChange() })} />
  </>
}

// ─── Types ──────────────────────────────────────────────────
function TypesTab({ T, L, rows, canEdit, companyId, onChange }: { T: TT; L: LL; rows: WindowType[]; canEdit: boolean; companyId: string; onChange: () => void }) {
  const [editing, setEditing] = useState<Partial<WindowType> | null>(null)
  const [toDelete, setToDelete] = useState<WindowType | null>(null)
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!editing?.name?.trim() || !editing.template) return
    setSaving(true)
    const payload = {
      name: editing.name.trim(), template: editing.template, is_active: editing.is_active ?? true,
      min_width: editing.min_width ?? 400, max_width: editing.max_width ?? 3000,
      min_height: editing.min_height ?? 400, max_height: editing.max_height ?? 2600,
    }
    const { error } = editing.id
      ? await supabase.from('window_types' as any).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      : await supabase.from('window_types' as any).insert({ ...payload, company_id: companyId, sort_order: rows.length })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setEditing(null); onChange()
  }
  return <>
    <div className="flex justify-end mb-3">{canEdit && <Button size="sm" className="gap-1.5" onClick={() => setEditing({ template: 'tilt_turn', is_active: true, min_width: 400, max_width: 1300, min_height: 400, max_height: 1800 })}><Plus className="w-4 h-4" />{T.add}</Button>}</div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {rows.map(r => <Card key={r.id} className={cn('p-4 flex flex-col', r.is_active === false && 'opacity-60')}>
        <div className="h-[130px] flex items-center justify-center mb-3">
          <WindowDrawing template={r.template} width={r.template.startsWith('door') || r.template === 'lift_slide' ? 900 : 1200} height={r.template.startsWith('door') || r.template === 'lift_slide' ? 2100 : 1300} size={120} />
        </div>
        <div className="text-sm font-medium text-gray-900">{r.name}</div>
        <div className="text-xs text-gray-500 mt-0.5">{L.templates[r.template]}</div>
        <div className="text-xs text-gray-400 mt-1">{r.min_width}–{r.max_width} × {r.min_height}–{r.max_height} mm</div>
        <div className="flex items-center justify-between mt-auto pt-2">
          <ActiveDot on={r.is_active !== false} T={T} />
          {canEdit && <RowActions onEdit={() => setEditing(r)} onDelete={() => setToDelete(r)} />}
        </div>
      </Card>)}
    </div>
    <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? T.edit : T.add} size="lg">
      {editing && <div className="grid sm:grid-cols-[1fr_200px] gap-5">
        <div className="space-y-3">
          <Input label={T.name} value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} autoFocus />
          <Select label={T.template} value={editing.template ?? 'tilt_turn'} onChange={v => setEditing({ ...editing, template: v as WindowTemplate })}
            options={TEMPLATES.map(t => ({ value: t, label: L.templates[t] }))} />
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label={T.minW} unit="mm" value={editing.min_width ?? null} onValue={v => setEditing({ ...editing, min_width: v ?? 0 })} decimals={0} />
            <NumberInput label={T.maxW} unit="mm" value={editing.max_width ?? null} onValue={v => setEditing({ ...editing, max_width: v ?? 0 })} decimals={0} />
            <NumberInput label={T.minH} unit="mm" value={editing.min_height ?? null} onValue={v => setEditing({ ...editing, min_height: v ?? 0 })} decimals={0} />
            <NumberInput label={T.maxH} unit="mm" value={editing.max_height ?? null} onValue={v => setEditing({ ...editing, max_height: v ?? 0 })} decimals={0} />
          </div>
          <Checkbox checked={editing.is_active ?? true} onChange={v => setEditing({ ...editing, is_active: v })} label={T.active} />
        </div>
        <div className="flex items-center justify-center bg-gray-50 rounded-lg p-3">
          <WindowDrawing template={editing.template ?? 'tilt_turn'} width={(editing.template ?? '').startsWith('door') || editing.template === 'lift_slide' ? 900 : 1200} height={(editing.template ?? '').startsWith('door') || editing.template === 'lift_slide' ? 2100 : 1300} size={170} />
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditing(null)}>✕</Button><Button onClick={save} loading={saving}>{T.save}</Button></div>
      </div>}
    </Modal>
    <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title={T.delete}
      message={`${T.deleteConfirm} „${toDelete?.name}“?`} confirmLabel={T.delete}
      onConfirm={() => toDelete && removeRow('window_types', toDelete.id, () => { setToDelete(null); onChange() })} />
  </>
}

// ─── Prices (system × type) ─────────────────────────────────
function PricesTab({ T, systems, types, prices, canEdit, companyId, currency, onChange }: {
  T: TT; systems: WindowSystem[]; types: WindowType[]; prices: WindowPrice[]; canEdit: boolean; companyId: string; currency: string; onChange: () => void
}) {
  const [sel, setSel] = useState<{ system_id: string; type_id: string } | null>(
    systems[0] && types[0] ? { system_id: systems[0].id, type_id: types[0].id } : null)
  const current = sel ? prices.find(p => p.system_id === sel.system_id && p.type_id === sel.type_id) : undefined
  const [draft, setDraft] = useState<WindowPrice | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [testW, setTestW] = useState<number | null>(1200)
  const [testH, setTestH] = useState<number | null>(1400)

  useEffect(() => {
    if (!sel) { setDraft(null); return }
    setDraft(current
      ? { ...current, matrix: { widths: [...(current.matrix?.widths ?? [])], heights: [...(current.matrix?.heights ?? [])], prices: (current.matrix?.prices ?? []).map(r => [...r]) } }
      : { system_id: sel.system_id, type_id: sel.type_id, matrix: { ...EMPTY_MATRIX }, price_per_m2: 0, min_price: 0 })
  }, [sel?.system_id, sel?.type_id, current?.id, prices])

  const has = (s: string, t: string) => {
    const p = prices.find(x => x.system_id === s && x.type_id === t)
    return !!p && (Number(p.price_per_m2) > 0 || (p.matrix?.widths?.length ?? 0) > 0)
  }

  function setMatrix(m: PriceMatrix) { if (draft) setDraft({ ...draft, matrix: m }) }
  function applyPaste() {
    const m = parseMatrix(pasteText)
    if (!m) { toast.error(T.invalidPaste); return }
    setMatrix(m); setPasteOpen(false); setPasteText('')
  }
  async function save() {
    if (!draft) return
    setSaving(true)
    const m = draft.matrix
    // keep widths/heights sorted together with their cells
    const wOrder = m.widths.map((w, i) => [w, i] as const).filter(([w]) => w > 0).sort((a, b) => a[0] - b[0])
    const hOrder = m.heights.map((h, i) => [h, i] as const).filter(([h]) => h > 0).sort((a, b) => a[0] - b[0])
    const matrix: PriceMatrix = {
      widths: wOrder.map(([w]) => w),
      heights: hOrder.map(([h]) => h),
      prices: hOrder.map(([, hi]) => wOrder.map(([, wi]) => m.prices[hi]?.[wi] ?? null)),
    }
    const { error } = await supabase.from('window_prices' as any).upsert({
      company_id: companyId, system_id: draft.system_id, type_id: draft.type_id, matrix,
      price_per_m2: draft.price_per_m2 ?? 0, min_price: draft.min_price ?? 0, updated_at: new Date().toISOString(),
    }, { onConflict: 'system_id,type_id' })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(T.save + ' ✓'); onChange()
  }

  const test = useMemo(() => draft && testW && testH ? basePrice(draft, testW, testH) : null, [draft, testW, testH])

  if (!systems.length || !types.length) return <div className="text-sm text-gray-500">{T.emptyHint}</div>

  return <div className="grid lg:grid-cols-[280px_1fr] gap-4">
    {/* Combination list */}
    <Card className="overflow-hidden self-start">
      {systems.map(s => <div key={s.id}>
        <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-100">{s.name}</div>
        {types.map(t => {
          const active = sel?.system_id === s.id && sel?.type_id === t.id
          return <button key={t.id} onClick={() => setSel({ system_id: s.id, type_id: t.id })}
            className={cn('w-full flex items-center justify-between px-3 py-2 text-sm text-left border-b border-gray-100 last:border-0',
              active ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700')}>
            <span className="truncate">{t.name}</span>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 ml-2', has(s.id, t.id) ? 'bg-green-500' : 'bg-gray-300')} title={has(s.id, t.id) ? T.priced : T.notPriced} />
          </button>
        })}
      </div>)}
    </Card>

    {/* Editor */}
    {draft && <div className="space-y-4 min-w-0">
      <Card className="p-4">
        <div className="text-sm font-medium text-gray-900 mb-3">
          {systems.find(s => s.id === draft.system_id)?.name} · {types.find(t => t.id === draft.type_id)?.name}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumberInput label={T.perM2} unit={currency} value={Number(draft.price_per_m2) || null} onValue={v => setDraft({ ...draft, price_per_m2: v ?? 0 })} decimals={2} />
          <NumberInput label={T.minPrice} unit={currency} value={Number(draft.min_price) || null} onValue={v => setDraft({ ...draft, min_price: v ?? 0 })} decimals={2} />
          <NumberInput label={`${T.test}: ${T.width}`} unit="mm" value={testW} onValue={setTestW} decimals={0} />
          <NumberInput label={T.height} unit="mm" value={testH} onValue={setTestH} decimals={0} />
        </div>
        <div className="mt-3 text-sm text-gray-600">{T.test}: <span className="font-medium text-gray-900">{test != null ? money(test, currency) : T.notPriced}</span></div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div className="text-sm font-medium text-gray-900">{T.matrix}</div>
          {canEdit && <div className="flex gap-2">
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setPasteOpen(true)}><ClipboardPaste className="w-3.5 h-3.5" />{T.paste}</Button>
            <Button size="sm" variant="ghost" onClick={() => setMatrix({ ...EMPTY_MATRIX })}>{T.clear}</Button>
          </div>}
        </div>
        <p className="text-xs text-gray-500 mb-3">{T.matrixHint}</p>
        <MatrixGrid m={draft.matrix} onChange={setMatrix} T={T} disabled={!canEdit} />
      </Card>

      {canEdit && <div className="flex justify-end"><Button onClick={save} loading={saving}>{T.save}</Button></div>}
    </div>}

    <Modal open={pasteOpen} onClose={() => setPasteOpen(false)} title={T.paste} size="lg">
      <p className="text-xs text-gray-500 mb-2">{T.pasteHint}</p>
      <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={10}
        placeholder={'\t600\t800\t1000\n600\t180\t205\t230\n800\t200\t228\t255'}
        className="w-full font-mono text-xs rounded-lg border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <div className="flex justify-end gap-2 mt-3"><Button variant="secondary" onClick={() => setPasteOpen(false)}>✕</Button><Button onClick={applyPaste}>{T.apply}</Button></div>
    </Modal>
  </div>
}

function MatrixGrid({ m, onChange, T, disabled }: { m: PriceMatrix; onChange: (m: PriceMatrix) => void; T: TT; disabled: boolean }) {
  const cell = 'w-[76px] px-1.5 py-1 text-xs text-right rounded border border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent'
  const n = (s: string) => { const v = Number(s.replace(',', '.')); return s.trim() === '' || isNaN(v) ? null : v }
  function setW(i: number, v: number | null) { const widths = [...m.widths]; widths[i] = v ?? 0; onChange({ ...m, widths }) }
  function setH(i: number, v: number | null) { const heights = [...m.heights]; heights[i] = v ?? 0; onChange({ ...m, heights }) }
  function setP(hi: number, wi: number, v: number | null) {
    const prices = m.heights.map((_, r) => m.widths.map((_, c) => m.prices[r]?.[c] ?? null))
    prices[hi][wi] = v; onChange({ ...m, prices })
  }
  function addCol() { const last = m.widths[m.widths.length - 1] ?? 400; onChange({ ...m, widths: [...m.widths, last + 200], prices: m.heights.map((_, r) => [...(m.prices[r] ?? []), null]) }) }
  function addRow() { const last = m.heights[m.heights.length - 1] ?? 400; onChange({ ...m, heights: [...m.heights, last + 200], prices: [...m.prices, m.widths.map(() => null)] }) }

  return <div className="overflow-x-auto">
    <table className="text-xs border-separate border-spacing-0">
      <thead><tr>
        <th className="px-1.5 py-1 text-gray-400 font-normal text-left">V \ Š</th>
        {m.widths.map((w, i) => <th key={i} className="bg-gray-50 border-b border-gray-200">
          <input disabled={disabled} className={cn(cell, 'font-medium text-gray-700')} value={w || ''} onChange={e => setW(i, n(e.target.value))} />
        </th>)}
        {!disabled && <th><button onClick={addCol} className="px-2 py-1 text-blue-600 hover:underline whitespace-nowrap">{T.addCol}</button></th>}
      </tr></thead>
      <tbody>
        {m.heights.map((h, hi) => <tr key={hi}>
          <td className="bg-gray-50 border-r border-gray-200"><input disabled={disabled} className={cn(cell, 'font-medium text-gray-700')} value={h || ''} onChange={e => setH(hi, n(e.target.value))} /></td>
          {m.widths.map((_, wi) => <td key={wi} className="border-b border-gray-100">
            <input disabled={disabled} className={cn(cell, 'text-gray-900')} value={m.prices[hi]?.[wi] ?? ''} onChange={e => setP(hi, wi, n(e.target.value))} />
          </td>)}
        </tr>)}
        {!disabled && <tr><td><button onClick={addRow} className="px-2 py-1 text-blue-600 hover:underline whitespace-nowrap">{T.addRow}</button></td></tr>}
      </tbody>
    </table>
  </div>
}

// ─── Options ────────────────────────────────────────────────
function OptionsTab({ T, L, rows, groups, pricings, hint, canEdit, companyId, currency, onChange }: { T: TT; L: LL; rows: WindowOption[]; groups: OptionGroup[]; pricings: OptionPricing[]; hint: string; canEdit: boolean; companyId: string; currency: string; onChange: () => void }) {
  const [editing, setEditing] = useState<Partial<WindowOption> | null>(null)
  const [toDelete, setToDelete] = useState<WindowOption | null>(null)
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!editing?.name?.trim() || !editing.group_key) return
    setSaving(true)
    const payload = {
      group_key: editing.group_key, name: editing.name.trim(), description: editing.description?.trim() || null,
      pricing: editing.pricing ?? 'piece', price: editing.price ?? 0, is_default: editing.is_default ?? false, is_active: editing.is_active ?? true,
    }
    const { error } = editing.id
      ? await supabase.from('window_options' as any).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      : await supabase.from('window_options' as any).insert({ ...payload, company_id: companyId, sort_order: rows.length })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setEditing(null); onChange()
  }
  const fmt = (o: WindowOption) => o.pricing === 'percent' ? `${Number(o.price ?? 0).toLocaleString('de-DE')} % cene okna` : `${money(Number(o.price ?? 0), currency)} ${L.pricing[o.pricing]}`
  return <>
    <div className="flex items-start justify-between gap-4 mb-3">
      <p className="text-sm text-gray-500 max-w-2xl">{hint}</p>
      {canEdit && <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setEditing({ group_key: groups[0], pricing: pricings[0], is_active: true })}><Plus className="w-4 h-4" />{T.add}</Button>}
    </div>
    <div className="space-y-4">
      {groups.filter(g => rows.some(r => r.group_key === g)).map(g => <Card key={g}>
        <div className="px-4 py-3 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200">{L.groups[g]}</div>
        <table className="w-full text-sm font-[450]"><tbody>
          {rows.filter(r => r.group_key === g).map(r => <tr key={r.id} className="border-b border-gray-200 last:border-0 hover:bg-gray-50">
            <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{r.name}{r.is_default && <span className="ml-2 text-xs text-blue-600">{T.dflt}</span>}</td>
            <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-right whitespace-nowrap">{fmt(r)}</td>
            <td className="px-4 py-3 w-28"><ActiveDot on={r.is_active !== false} T={T} /></td>
            <td className="px-4 py-3 w-20">{canEdit && <RowActions onEdit={() => setEditing(r)} onDelete={() => setToDelete(r)} />}</td>
          </tr>)}
        </tbody></table>
      </Card>)}
    </div>
    <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? T.edit : T.add}>
      {editing && <div className="space-y-3">
        <Select label={T.group} value={editing.group_key ?? groups[0]} onChange={v => setEditing({ ...editing, group_key: v as OptionGroup })}
          options={groups.map(g => ({ value: g, label: L.groups[g] }))} />
        <Input label={T.name} value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Select label={T.pricing} value={editing.pricing ?? pricings[0]} onChange={v => setEditing({ ...editing, pricing: v as OptionPricing })}
            options={pricings.map(p => ({ value: p, label: L.pricing[p] }))} />
          <NumberInput label={T.price} unit={editing.pricing === 'percent' ? '%' : currency} value={editing.price ?? null} onValue={v => setEditing({ ...editing, price: v ?? 0 })} decimals={2} />
        </div>
        <Checkbox checked={editing.is_default ?? false} onChange={v => setEditing({ ...editing, is_default: v })} label={T.isDefault} />
        <Checkbox checked={editing.is_active ?? true} onChange={v => setEditing({ ...editing, is_active: v })} label={T.active} />
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => setEditing(null)}>✕</Button><Button onClick={save} loading={saving}>{T.save}</Button></div>
      </div>}
    </Modal>
    <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title={T.delete}
      message={`${T.deleteConfirm} „${toDelete?.name}“?`} confirmLabel={T.delete}
      onConfirm={() => toDelete && removeRow('window_options', toDelete.id, () => { setToDelete(null); onChange() })} />
  </>
}

// ─── Configurator settings ──────────────────────────────────
function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

function ConfiguratorTab({ T, canEdit, company, onSaved }: { T: TT; canEdit: boolean; company: NonNullable<ReturnType<typeof useCompany>['company']>; onSaved: () => void }) {
  const [form, setForm] = useState({
    enabled: company.configurator_enabled ?? false,
    slug: company.configurator_slug ?? slugify(company.name),
    show: company.configurator_show_prices ?? true,
    accent: company.configurator_accent ?? '#2563eb',
    intro: company.configurator_intro ?? '',
  })
  const [saving, setSaving] = useState(false)
  const slugOk = /^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$/.test(form.slug)
  const url = `${window.location.origin}/k/${form.slug}`
  const embed = `<iframe src="${url}" style="width:100%;height:900px;border:0" title="Konfigurator oken"></iframe>`

  async function save() {
    if (!slugOk) { toast.error(T.slugInvalid); return }
    setSaving(true)
    const { error } = await supabase.from('companies').update({
      configurator_enabled: form.enabled, configurator_slug: form.slug, configurator_show_prices: form.show,
      configurator_accent: form.accent, configurator_intro: form.intro.trim() || null,
    } as any).eq('id', company.id)
    setSaving(false)
    if (error) { toast.error(error.code === '23505' ? T.slugTaken : error.message); return }
    toast.success(T.save + ' ✓'); onSaved()
  }
  function copy(text: string) { navigator.clipboard.writeText(text).then(() => toast.success(T.copied)) }

  return <div className="max-w-2xl space-y-4">
    <Card className="p-5 space-y-4">
      <Checkbox checked={form.enabled} onChange={v => setForm({ ...form, enabled: v })} label={T.cfgEnabled} />
      <Input label={T.cfgSlug} value={form.slug} onChange={e => setForm({ ...form, slug: slugify(e.target.value) })} error={slugOk ? undefined : T.slugInvalid} disabled={!canEdit} />
      <Checkbox checked={form.show} onChange={v => setForm({ ...form, show: v })} label={T.cfgShowPrices} />
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{T.cfgAccent}</label>
        <div className="flex items-center gap-2">
          <input type="color" value={form.accent} onChange={e => setForm({ ...form, accent: e.target.value })} className="h-9 w-12 rounded border border-gray-200 bg-white p-1" />
          <span className="text-sm font-mono text-gray-600">{form.accent}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{T.cfgIntro}</label>
        <textarea rows={3} value={form.intro} onChange={e => setForm({ ...form, intro: e.target.value })}
          className="w-full rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {canEdit && <div className="flex justify-end"><Button onClick={save} loading={saving}>{T.save}</Button></div>}
    </Card>

    <Card className="p-5 space-y-3">
      <div className="text-sm font-medium text-gray-900">{T.cfgLink}</div>
      <div className="flex gap-2">
        <input readOnly value={url} className="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-gray-50" />
        <Button variant="secondary" className="gap-1.5" onClick={() => copy(url)}><Copy className="w-4 h-4" />{T.copy}</Button>
        <a href={url} target="_blank" rel="noreferrer"><Button variant="secondary" className="gap-1.5"><ExternalLink className="w-4 h-4" />{T.open}</Button></a>
      </div>
      <div className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{T.embed}</div>
      <div className="flex gap-2">
        <textarea readOnly rows={2} value={embed} className="flex-1 min-w-0 font-mono text-xs rounded-lg border border-gray-200 px-3 py-2 text-gray-700 bg-gray-50" />
        <Button variant="secondary" className="gap-1.5 self-start" onClick={() => copy(embed)}><Copy className="w-4 h-4" />{T.copy}</Button>
      </div>
    </Card>
  </div>
}
