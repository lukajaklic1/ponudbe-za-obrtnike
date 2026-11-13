import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Tags, Plus, Trash2, Check, Settings2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import Button from '../components/ui/Button'
import NumberInput from '../components/ui/NumberInput'
import { PageHeader } from '../components/ui/PageHeader'
import WindowDrawing from '../components/WindowDrawing'
import { cn } from '../lib/cn'
import {
  TEMPLATES, MATERIALS, STARTER, WL, SERVICE_GROUPS, serviceLine,
  type WindowSystem, type WindowType, type WindowOption, type WindowTemplate, type WindowMaterial,
  type OptionGroup, type OptionPricing,
} from '../lib/windows'

// Guided price list: one page, top to bottom. Shapes → materials (price per m²) → colours,
// glass, handles, sills & shading → services. Saving builds window_prices for every
// material × shape automatically, so nobody has to fill in tables.

interface ShapeRow { id?: string; template: WindowTemplate; on: boolean; name: string; surcharge: number | null; min_width: number; max_width: number; min_height: number; max_height: number }
interface MaterialRow { id?: string; material: WindowMaterial; on: boolean; name: string; price: number | null; min: number | null }
interface OptionRow { key: string; id?: string; group_key: OptionGroup; name: string; pricing: OptionPricing; price: number | null; is_default: boolean; swatch?: string }

interface Preset { name: string; pricing: OptionPricing; price: number; swatch?: string }
interface Section { group: OptionGroup; title: string; hint: string; units: OptionPricing[]; single: boolean; presets: Preset[] }

const isDoor = (t: WindowTemplate) => t.startsWith('door') || t === 'lift_slide'
let seq = 0
const nk = () => `o${++seq}`

const TXT = {
  sl: {
    title: 'Cenik',
    intro: 'Cenik nastaviš od zgoraj navzdol. Iz tega se samodejno izračunajo cene vseh oken v ponudbah in v spletnem konfiguratorju.',
    s1: 'Katere oblike oken ponujate?', s1hint: 'Klikni oblike, ki jih prodajaš. Pri dražjih oblikah lahko dodaš doplačilo v % na ceno materiala.',
    surcharge: 'Doplačilo', s2: 'Iz katerih materialov?', s2hint: 'Obkljukaj materiale in vpiši ceno okna na m². Najnižja cena velja za majhna okna.',
    matName: 'Naziv (npr. PVC 82 mm)', perM2: 'Cena na m²', minPrice: 'Najnižja cena okna',
    add: 'Dodaj', name: 'Naziv', price: 'Cena', dflt: 'Privzeto', quick: 'Hitro dodaj:', remove: 'Odstrani',
    save: 'Shrani cenik', saved: 'Cenik je shranjen', unsaved: 'Spremembe niso shranjene',
    example: 'Primer', exampleText: (shape: string, mat: string, price: string) => `${shape}, ${mat}, 1200 × 1400 mm: ${price}`,
    advanced: 'Napredno: cenovne matrike in spletni konfigurator',
    preview: 'Predogled cene', live: 'v živo', width: 'Širina', height: 'Višina', totalNet: 'Skupaj brez DDV', previewHint: 'Vključene so privzete izbire. Tako bo stranka videla ceno v konfiguratorju.', needOne: 'Izberi vsaj eno obliko in en material.',
  },
  en: {
    title: 'Price list',
    intro: 'Set up the price list from top to bottom. Every window price in quotes and in the online configurator is calculated from it.',
    s1: 'Which window shapes do you offer?', s1hint: 'Click the shapes you sell. For more complex shapes you can add a % surcharge on the material price.',
    surcharge: 'Surcharge', s2: 'Which materials?', s2hint: 'Tick the materials and enter the window price per m². The minimum price applies to small windows.',
    matName: 'Name (e.g. PVC 82 mm)', perM2: 'Price per m²', minPrice: 'Minimum window price',
    add: 'Add', name: 'Name', price: 'Price', dflt: 'Default', quick: 'Quick add:', remove: 'Remove',
    save: 'Save price list', saved: 'Price list saved', unsaved: 'Unsaved changes',
    example: 'Example', exampleText: (shape: string, mat: string, price: string) => `${shape}, ${mat}, 1200 × 1400 mm: ${price}`,
    advanced: 'Advanced: price matrices and online configurator',
    preview: 'Price preview', live: 'live', width: 'Width', height: 'Height', totalNet: 'Total excl. VAT', previewHint: 'Default choices are included. This is the price the customer sees in the configurator.', needOne: 'Pick at least one shape and one material.',
  },
}

function sectionsFor(lang: 'sl' | 'en'): Section[] {
  const sl = lang === 'sl'
  return [
    { group: 'color', title: sl ? 'Barve' : 'Colours', hint: sl ? 'Za koliko barva zviša ceno okna na m² (bela je običajno brez doplačila).' : 'How much a colour adds to the window price per m² (white is usually free).',
      units: ['m2', 'percent'], single: true,
      presets: [{ name: 'Bela', pricing: 'm2', price: 0, swatch: '#ffffff' }, { name: 'Antracit', pricing: 'm2', price: 35, swatch: '#383e42' }, { name: 'Zlati hrast', pricing: 'm2', price: 45, swatch: '#b5763a' }, { name: 'Orehov les', pricing: 'm2', price: 45, swatch: '#6b4a2e' }, { name: 'Črna', pricing: 'm2', price: 40, swatch: '#1d1d1d' }] },
    { group: 'glass', title: sl ? 'Steklo' : 'Glass', hint: sl ? 'Doplačilo za steklo na m² okna.' : 'Glass surcharge per m² of window.',
      units: ['m2'], single: true,
      presets: [{ name: 'Dvoslojno Ug 1,1', pricing: 'm2', price: 0 }, { name: 'Troslojno Ug 0,6', pricing: 'm2', price: 45 }, { name: 'Varnostno steklo', pricing: 'm2', price: 85 }] },
    { group: 'handle', title: sl ? 'Kljuke' : 'Handles', hint: sl ? 'Cena na kos okna.' : 'Price per window.',
      units: ['piece'], single: true,
      presets: [{ name: 'Standardna kljuka', pricing: 'piece', price: 0 }, { name: 'Kljuka s ključem', pricing: 'piece', price: 28 }] },
    { group: 'sill', title: sl ? 'Police' : 'Sills', hint: sl ? 'Police se običajno računajo na tekoči meter širine okna.' : 'Sills are usually priced per metre of window width.',
      units: ['width', 'piece'], single: false,
      presets: [{ name: 'Notranja polica PVC', pricing: 'width', price: 38 }, { name: 'Zunanja ALU polica', pricing: 'width', price: 42 }] },
    { group: 'shading', title: sl ? 'Senčila in komarniki' : 'Shading and insect screens', hint: sl ? 'Žaluzije in rolete na m², komarniki na kos.' : 'Blinds per m², insect screens per piece.',
      units: ['m2', 'piece', 'width'], single: false,
      presets: [{ name: 'Zunanje žaluzije', pricing: 'm2', price: 160 }, { name: 'Rolete', pricing: 'm2', price: 120 }, { name: 'Komarnik', pricing: 'piece', price: 65 }] },
    { group: 'installation', title: sl ? 'Montaža' : 'Installation', hint: sl ? 'Montaža na tekoči meter obsega okna 2 × (širina + višina) ali na kos. Stranka izbere eno.' : 'Installation per metre of perimeter 2 × (width + height) or per piece. The customer picks one.',
      units: ['perimeter', 'piece'], single: true,
      presets: [{ name: 'Klasična montaža (PU pena, sidra)', pricing: 'perimeter', price: 9 }, { name: 'RAL montaža (tesnilni trakovi)', pricing: 'perimeter', price: 16 }] },
    { group: 'removal', title: sl ? 'Demontaža' : 'Removal', hint: sl ? 'Demontaža starih oken, na tm obsega ali na kos.' : 'Removing old windows, per metre of perimeter or per piece.',
      units: ['perimeter', 'piece'], single: false,
      presets: [{ name: 'Demontaža starih oken', pricing: 'perimeter', price: 6 }] },
    { group: 'finishing', title: sl ? 'Zaključna dela' : 'Finishing', hint: sl ? 'Obdelava špalet, montaža polic …' : 'Reveal finishing, fitting sills …',
      units: ['perimeter', 'width', 'piece'], single: false,
      presets: [{ name: 'Zidarska obdelava špalet', pricing: 'perimeter', price: 12 }, { name: 'Montaža notranjih polic', pricing: 'width', price: 14 }] },
    { group: 'transport', title: sl ? 'Prevoz in odvoz' : 'Transport and disposal', hint: sl ? 'Pavšal enkrat na ponudbo.' : 'Flat, once per quote.',
      units: ['flat'], single: false,
      presets: [{ name: 'Dostava na objekt', pricing: 'flat', price: 50 }, { name: 'Odvoz in ekološka odstranitev', pricing: 'flat', price: 80 }] },
  ]
}

export default function PriceListSetupPage() {
  const { company, hasPerm, loading: permLoading } = useCompany()
  const { lang } = useLanguage()
  const T = TXT[lang]
  const L = WL[lang]
  const sections = useMemo(() => sectionsFor(lang), [lang])
  const canEdit = hasPerm('price_list', 'create')
  const cur = company?.currency ?? 'EUR'
  const money = (n: number) => Number(n).toLocaleString('de-DE', { style: 'currency', currency: cur })

  const [shapes, setShapes] = useState<ShapeRow[]>([])
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [options, setOptions] = useState<OptionRow[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pv, setPv] = useState<{ template?: WindowTemplate; material?: WindowMaterial; width: number; height: number }>({ width: 1200, height: 1400 })

  useEffect(() => { if (company) load() }, [company?.id])
  async function load() {
    if (!company) return
    const [s, t, o] = await Promise.all([
      supabase.from('window_systems' as any).select('*').eq('company_id', company.id).order('sort_order'),
      supabase.from('window_types' as any).select('*').eq('company_id', company.id).order('sort_order'),
      supabase.from('window_options' as any).select('*').eq('company_id', company.id).eq('is_active', true).order('sort_order'),
    ])
    const sys = (s.data ?? []) as unknown as WindowSystem[]
    const typ = (t.data ?? []) as unknown as WindowType[]
    const opt = (o.data ?? []) as unknown as WindowOption[]
    const starterType = (tpl: WindowTemplate) => STARTER.types.find(x => x.template === tpl)
    setShapes(TEMPLATES.map(tpl => {
      const row = typ.find(x => x.template === tpl)
      const st = starterType(tpl)
      return {
        id: row?.id, template: tpl, on: !!row && row.is_active !== false, name: row?.name ?? st?.name ?? L.templates[tpl],
        surcharge: row ? Number(row.surcharge_pct ?? 0) : st ? Math.round((st.factor - 1) * 100) : 0,
        min_width: row?.min_width ?? 400, max_width: row?.max_width ?? st?.max_width ?? (isDoor(tpl) ? 2200 : 2400),
        min_height: row?.min_height ?? 400, max_height: row?.max_height ?? st?.max_height ?? (isDoor(tpl) ? 2500 : 1800),
      }
    }))
    setMaterials(MATERIALS.map(m => {
      const row = sys.find(x => x.material === m)
      return { id: row?.id, material: m, on: !!row && row.is_active !== false, name: row?.name ?? L.materials[m], price: row ? Number(row.price_per_m2 ?? 0) || null : null, min: row ? Number(row.min_price ?? 0) || null : null }
    }))
    setOptions(opt.map(x => ({ key: nk(), id: x.id, group_key: x.group_key, name: x.name, pricing: x.pricing, price: x.price == null ? null : Number(x.price), is_default: x.is_default, swatch: x.group_key === 'color' && /^#[0-9a-f]{6}$/i.test(x.description ?? '') ? x.description! : undefined })))
    setRemoved([]); setDirty(false); setLoading(false)
  }

  const touch = () => setDirty(true)
  const setShape = (tpl: WindowTemplate, patch: Partial<ShapeRow>) => { setShapes(xs => xs.map(x => x.template === tpl ? { ...x, ...patch } : x)); touch() }
  const setMaterial = (m: WindowMaterial, patch: Partial<MaterialRow>) => { setMaterials(xs => xs.map(x => x.material === m ? { ...x, ...patch } : x)); touch() }
  const setOption = (key: string, patch: Partial<OptionRow>) => { setOptions(xs => xs.map(x => x.key === key ? { ...x, ...patch } : x)); touch() }
  function addOption(sec: Section, preset?: Preset) {
    const first = !options.some(o => o.group_key === sec.group)
    setOptions(xs => [...xs, { key: nk(), group_key: sec.group, name: preset?.name ?? '', pricing: preset?.pricing ?? sec.units[0], price: preset?.price ?? null, is_default: sec.single && first, swatch: sec.group === 'color' ? preset?.swatch ?? '#ffffff' : undefined }])
    touch()
  }
  function removeOption(row: OptionRow) {
    if (row.id) setRemoved(r => [...r, row.id!])
    setOptions(xs => xs.filter(x => x.key !== row.key)); touch()
  }
  function setDefault(sec: Section, row: OptionRow) {
    // single-choice groups have exactly one default, add-ons toggle freely
    if (sec.single) setOptions(xs => xs.map(x => x.group_key === sec.group ? { ...x, is_default: x.key === row.key } : x))
    else setOption(row.key, { is_default: !row.is_default })
    touch()
  }

  async function save() {
    if (!company) return
    if (!shapes.some(s => s.on) || !materials.some(m => m.on)) { toast.error(T.needOne); return }
    setSaving(true)
    try {
      const now = new Date().toISOString()
      // materials → window_systems
      const sysIds: Record<string, string> = {}
      for (const [i, m] of materials.entries()) {
        const payload = { name: m.name.trim() || L.materials[m.material], material: m.material, price_per_m2: m.price ?? 0, min_price: m.min ?? 0, is_active: m.on, sort_order: i, updated_at: now }
        if (m.id) {
          const { error } = await supabase.from('window_systems' as any).update(payload).eq('id', m.id); if (error) throw error
          sysIds[m.material] = m.id
        } else if (m.on) {
          const { data, error } = await supabase.from('window_systems' as any).insert({ ...payload, company_id: company.id }).select('id').single(); if (error) throw error
          sysIds[m.material] = (data as unknown as { id: string }).id
        }
      }
      // shapes → window_types
      const typeIds: Record<string, string> = {}
      for (const [i, s] of shapes.entries()) {
        const payload = { name: s.name.trim() || L.templates[s.template], template: s.template, surcharge_pct: s.surcharge ?? 0, min_width: s.min_width, max_width: s.max_width, min_height: s.min_height, max_height: s.max_height, is_active: s.on, sort_order: i, updated_at: now }
        if (s.id) {
          const { error } = await supabase.from('window_types' as any).update(payload).eq('id', s.id); if (error) throw error
          typeIds[s.template] = s.id
        } else if (s.on) {
          const { data, error } = await supabase.from('window_types' as any).insert({ ...payload, company_id: company.id }).select('id').single(); if (error) throw error
          typeIds[s.template] = (data as unknown as { id: string }).id
        }
      }
      // every active material × shape gets a price (matrices from the advanced page stay untouched)
      const priceRows = materials.filter(m => m.on && sysIds[m.material]).flatMap(m => shapes.filter(s => s.on && typeIds[s.template]).map(s => ({
        company_id: company.id, system_id: sysIds[m.material], type_id: typeIds[s.template],
        price_per_m2: Math.round((m.price ?? 0) * (1 + (s.surcharge ?? 0) / 100) * 100) / 100,
        min_price: m.min ?? 0, updated_at: now,
      })))
      if (priceRows.length) {
        const { error } = await supabase.from('window_prices' as any).upsert(priceRows, { onConflict: 'system_id,type_id' }); if (error) throw error
      }
      // extras and services
      if (removed.length) {
        const { error } = await supabase.from('window_options' as any).delete().in('id', removed); if (error) throw error
      }
      for (const [i, o] of options.entries()) {
        if (!o.name.trim()) continue
        const payload = { group_key: o.group_key, name: o.name.trim(), pricing: o.pricing, price: o.price ?? 0, is_default: o.is_default, is_active: true, sort_order: i, updated_at: now, ...(o.group_key === 'color' ? { description: o.swatch ?? null } : {}) }
        const { error } = o.id
          ? await supabase.from('window_options' as any).update(payload).eq('id', o.id)
          : await supabase.from('window_options' as any).insert({ ...payload, company_id: company.id })
        if (error) throw error
      }
      toast.success(T.saved)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!permLoading && !hasPerm('price_list', 'view')) return <Navigate to="/dashboard" replace />

  // live preview (like Fenestro): one example window, base price + every default choice as its own line
  const activeShapes = shapes.filter(s => s.on)
  const activeMats = materials.filter(m => m.on)
  const pShape = activeShapes.find(s => s.template === pv.template) ?? activeShapes.find(s => s.template === 'double') ?? activeShapes[0]
  const pMat = activeMats.find(m => m.material === pv.material) ?? activeMats[0]
  const area = pv.width * pv.height / 1_000_000
  const pBase = pShape && pMat ? Math.round(Math.max(pMat.min ?? 0, area * (pMat.price ?? 0) * (1 + (pShape.surcharge ?? 0) / 100)) * 100) / 100 : null
  const addOn = (o: OptionRow) => {
    const price = o.price ?? 0
    if (o.pricing === 'piece') return price
    if (o.pricing === 'm2') return price * area
    if (o.pricing === 'percent') return (pBase ?? 0) * price / 100
    if (o.pricing === 'perimeter') return price * 2 * (pv.width + pv.height) / 1000
    if (o.pricing === 'width') return price * pv.width / 1000
    return price
  }
  const isSvc = (o: OptionRow) => (SERVICE_GROUPS as string[]).includes(o.group_key) || o.pricing === 'flat'
  const pExtras = options.filter(o => o.is_default && o.name.trim() && !isSvc(o)).map(o => ({ name: o.name, swatch: o.swatch, amount: Math.round(addOn(o) * 100) / 100 }))
  const pServices = options.filter(o => o.is_default && o.name.trim() && isSvc(o)).map(o => ({
    name: o.name,
    amount: serviceLine({ id: o.key, group_key: o.group_key, name: o.name, description: null, pricing: o.pricing, price: o.price, is_default: true }, [{ width: pv.width, height: pv.height, quantity: 1, base: pBase }]).total,
  }))
  const pTotal = (pBase ?? 0) + pExtras.reduce((a, x) => a + x.amount, 0) + pServices.reduce((a, x) => a + x.amount, 0)
  const pColor = options.find(o => o.group_key === 'color' && o.is_default)?.swatch

  return (
    <div>
      <PageHeader title={T.title} icon={Tags} action={canEdit && <Button onClick={save} loading={saving} className="gap-2"><Check className="w-4 h-4" />{T.save}</Button>} />
      <div className="p-4 lg:p-6 pb-28 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start max-w-6xl">
        <div className="min-w-0">
        <p className="text-sm text-gray-500 mb-6">{T.intro}</p>

        {loading ? <div className="text-sm text-gray-400">…</div> : <div className="space-y-6">
          {/* 1. shapes */}
          <Step n={1} title={T.s1} hint={T.s1hint}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {shapes.map(s => (
                <div key={s.template} className={cn('rounded-xl border p-3 flex flex-col transition-colors', s.on ? 'border-gray-900 bg-white' : 'border-gray-200 bg-white hover:border-gray-300')}>
                  <button type="button" disabled={!canEdit} onClick={() => setShape(s.template, { on: !s.on })} className="text-left">
                    <div className="h-[84px] flex items-center justify-center">
                      <WindowDrawing template={s.template} width={isDoor(s.template) ? 900 : 1200} height={isDoor(s.template) ? 2100 : 1300} size={76} />
                    </div>
                    <div className="flex items-start gap-1.5 mt-2">
                      <span className={cn('mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border', s.on ? 'bg-gray-900 border-gray-900' : 'border-gray-300')}>{s.on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}</span>
                      <span className="text-xs font-medium text-gray-900 leading-snug">{L.templates[s.template]}</span>
                    </div>
                  </button>
                  {s.on && <div className="mt-2">
                    <NumberInput label={T.surcharge} unit="%" value={s.surcharge} onValue={v => setShape(s.template, { surcharge: v })} decimals={0} />
                  </div>}
                </div>
              ))}
            </div>
          </Step>

          {/* 2. materials */}
          <Step n={2} title={T.s2} hint={T.s2hint}>
            <div className="space-y-2">
              {materials.map(m => (
                <div key={m.material} className={cn('rounded-xl border px-4 py-3', m.on ? 'border-gray-900' : 'border-gray-200')}>
                  <button type="button" disabled={!canEdit} onClick={() => setMaterial(m.material, { on: !m.on })} className="flex items-center gap-2.5 w-full text-left">
                    <span className={cn('w-4 h-4 rounded flex items-center justify-center shrink-0 border', m.on ? 'bg-gray-900 border-gray-900' : 'border-gray-300')}>{m.on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}</span>
                    <span className="text-sm font-medium text-gray-900">{L.materials[m.material]}</span>
                  </button>
                  {m.on && <div className="grid sm:grid-cols-3 gap-3 mt-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium" style={{ color: '#7f7f7f' }}>{T.matName}</label>
                      <input value={m.name} onChange={e => setMaterial(m.material, { name: e.target.value })} disabled={!canEdit}
                        className="rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <NumberInput label={T.perM2} unit={`${cur}/m²`} value={m.price} onValue={v => setMaterial(m.material, { price: v })} decimals={2} />
                    <NumberInput label={T.minPrice} unit={cur} value={m.min} onValue={v => setMaterial(m.material, { min: v })} decimals={2} />
                  </div>}
                </div>
              ))}
            </div>
          </Step>

          {/* 3+. extras and services */}
          {sections.map((sec, i) => {
            const rows = options.filter(o => o.group_key === sec.group)
            const unused = sec.presets.filter(p => !rows.some(r => r.name.trim().toLowerCase() === p.name.toLowerCase()))
            return (
              <Step key={sec.group} n={i + 3} title={sec.title} hint={sec.hint}>
                <div className="space-y-2">
                  {rows.map(r => (
                    <div key={r.key} className="flex flex-wrap items-center gap-2">
                      {sec.group === 'color' && <label className="relative w-9 h-9 rounded-full border border-gray-300 shrink-0 cursor-pointer overflow-hidden" style={{ backgroundColor: r.swatch ?? '#ffffff' }} title={r.swatch}>
                        <input type="color" value={r.swatch ?? '#ffffff'} disabled={!canEdit} onChange={e => setOption(r.key, { swatch: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </label>}
                      <input value={r.name} onChange={e => setOption(r.key, { name: e.target.value })} placeholder={T.name} disabled={!canEdit}
                        className="flex-1 min-w-[200px] rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <div className="w-32"><NumberInput value={r.price} onValue={v => setOption(r.key, { price: v })} unit={r.pricing === 'percent' ? '%' : cur} decimals={2} /></div>
                      {sec.units.length > 1
                        ? <select value={r.pricing} disabled={!canEdit} onChange={e => setOption(r.key, { pricing: e.target.value as OptionPricing })}
                            className="rounded-lg border border-gray-200 hover:border-gray-400 px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {sec.units.map(u => <option key={u} value={u}>{L.pricing[u]}</option>)}
                          </select>
                        : <span className="text-sm text-gray-500 px-1">{L.pricing[r.pricing]}</span>}
                      <button type="button" disabled={!canEdit} onClick={() => setDefault(sec, r)} title={T.dflt}
                        className={cn('inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium', r.is_default ? 'border-gray-900 text-gray-900' : 'border-gray-200 text-gray-400 hover:text-gray-700')}>
                        {r.is_default && <Check className="w-3 h-3" />}{T.dflt}
                      </button>
                      {canEdit && <button type="button" onClick={() => removeOption(r)} title={T.remove} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
                {canEdit && <div className="flex flex-wrap items-center gap-2 mt-3">
                  <button type="button" onClick={() => addOption(sec)} className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:underline"><Plus className="w-4 h-4" />{T.add}</button>
                  {unused.length > 0 && <>
                    <span className="text-xs text-gray-400 ml-2">{T.quick}</span>
                    {unused.map(p => <button key={p.name} type="button" onClick={() => addOption(sec, p)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 text-xs text-gray-600 hover:border-gray-400">{p.swatch && <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: p.swatch }} />}+ {p.name}</button>)}
                  </>}
                </div>}
              </Step>
            )
          })}

          <Link to="/windows/advanced" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"><Settings2 className="w-4 h-4" />{T.advanced}</Link>
        </div>}
        </div>

        {/* live preview */}
        {!loading && <aside className="lg:sticky lg:top-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">{T.preview}</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />{T.live}</span>
          </div>
          {pShape && pMat ? <div className="p-4 space-y-4">
            <div className="flex justify-center rounded-lg bg-gray-50 py-4" style={{ backgroundImage: 'linear-gradient(#eef0f2 1px, transparent 1px), linear-gradient(90deg, #eef0f2 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
              <WindowDrawing template={pShape.template} width={pv.width} height={pv.height} size={190} showDims frameColor={pColor && pColor.toLowerCase() !== '#ffffff' ? pColor : '#f8fafc'} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeShapes.map(sh => <button key={sh.template} type="button" onClick={() => setPv(v => ({ ...v, template: sh.template }))}
                className={cn('px-2 py-1 rounded-md border text-xs', sh.template === pShape.template ? 'border-gray-900 text-gray-900 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-400')}>{L.templates[sh.template]}</button>)}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeMats.map(m => <button key={m.material} type="button" onClick={() => setPv(v => ({ ...v, material: m.material }))}
                className={cn('px-2 py-1 rounded-md border text-xs', m.material === pMat.material ? 'border-gray-900 text-gray-900 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-400')}>{m.name || L.materials[m.material]}</button>)}
            </div>
            {([['width', T.width, pShape.min_width, pShape.max_width], ['height', T.height, pShape.min_height, pShape.max_height]] as const).map(([k, label, min, max]) => (
              <div key={k}>
                <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{label}</span><span className="font-medium text-gray-900">{pv[k]} mm</span></div>
                <input type="range" min={min} max={max} step={10} value={Math.min(max, Math.max(min, pv[k]))} onChange={e => setPv(v => ({ ...v, [k]: Number(e.target.value) }))} className="w-full accent-gray-900" />
              </div>
            ))}
            <div className="border-t border-gray-200 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><span className="text-gray-900">{L.templates[pShape.template]} · {pMat.name || L.materials[pMat.material]}</span><span className="text-gray-900 whitespace-nowrap">{money(pBase ?? 0)}</span></div>
              {pExtras.map(x => <div key={x.name} className="flex justify-between gap-3 text-gray-500"><span className="flex items-center gap-1.5 min-w-0 truncate">{x.swatch && <span className="w-3 h-3 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: x.swatch }} />}{x.name}</span><span className="whitespace-nowrap">+ {money(x.amount)}</span></div>)}
              {pServices.map(x => <div key={x.name} className="flex justify-between gap-3 text-gray-500"><span className="min-w-0 truncate">{x.name}</span><span className="whitespace-nowrap">+ {money(x.amount)}</span></div>)}
              <div className="flex justify-between gap-3 pt-2 border-t border-gray-100 font-semibold text-gray-900"><span>{T.totalNet}</span><span>{money(pTotal)}</span></div>
              <p className="text-xs text-gray-400">{T.previewHint}</p>
            </div>
          </div> : <p className="p-4 text-sm text-gray-500">{T.needOne}</p>}
        </aside>}
      </div>

      {/* sticky save bar */}
      {canEdit && dirty && <div className="fixed bottom-0 right-0 left-0 lg:left-64 z-30 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-3">
        <span className="text-sm text-gray-500">{T.unsaved}</span>
        <Button onClick={save} loading={saving} className="gap-2"><Check className="w-4 h-4" />{T.save}</Button>
      </div>}
    </div>
  )
}

function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">{n}</span>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  )
}
