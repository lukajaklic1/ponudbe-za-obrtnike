import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, Copy, Check, Loader2, Phone, Mail, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../hooks/useLanguage'
import WindowDrawing from '../components/WindowDrawing'
import { cn } from '../lib/cn'
import {
  WL, OPTION_GROUPS, SINGLE_CHOICE_GROUPS, basePrice, unitPrice, money, hasHingeChoice,
  type WindowSystem, type WindowType, type WindowPrice, type WindowOption, type Hinge, type OptionGroup,
} from '../lib/windows'

// Public window configurator: /k/:slug — no login. Prices are recomputed on the server on submit.

interface ConfigData {
  company: { name: string; logo_url: string | null; email: string | null; phone: string | null; currency: string; accent: string; intro: string | null; show_prices: boolean; vat_rate: number }
  systems: WindowSystem[]
  types: WindowType[]
  prices: WindowPrice[]
  combos: { system_id: string; type_id: string }[]
  options: WindowOption[]
}

interface Item {
  key: string
  type_id: string
  system_id: string
  width: number | null
  height: number | null
  hinge: Hinge
  quantity: number
  label: string
  option_ids: string[]
}

const TXT = {
  sl: {
    title: 'Konfigurator oken', notFound: 'Konfigurator ni na voljo.', notFoundHint: 'Povezava je napačna ali pa ga ponudnik še ni vklopil.',
    step1: 'Tip okna', step2: 'Profilni sistem', step3: 'Mere in odpiranje', step4: 'Oprema',
    width: 'Širina', height: 'Višina', range: 'dovoljeno', hinge: 'Stran nasadil (gledano od znotraj)', qty: 'Količina', label: 'Prostor (neobvezno)', labelPh: 'npr. dnevna soba',
    none: 'Brez', yourOrder: 'Vaše povpraševanje', position: 'Pozicija', addWindow: 'Dodaj okno', duplicate: 'Podvoji', remove: 'Odstrani',
    unit: 'cena/kos', total: 'Skupaj brez DDV', vat: 'DDV', gross: 'Skupaj z DDV', estimate: 'Okvirna cena. Končno ponudbo pripravimo po izmeri na terenu.',
    noPrice: 'Cena po izmeri', pricesHidden: 'Ceno prejmete v ponudbi na e-mail.',
    next: 'Nadaljuj na podatke', back: 'Nazaj na okna', send: 'Pošlji povpraševanje', sending: 'Pošiljam …',
    contact: 'Vaši podatki', firstName: 'Ime', lastName: 'Priimek', email: 'E-pošta', phone: 'Telefon', address: 'Naslov objekta', note: 'Opomba',
    consent: 'Strinjam se, da ponudnik moje podatke uporabi za pripravo ponudbe.',
    doneTitle: 'Hvala, povpraševanje je oddano!', doneText: 'Ponudnik bo pripravil ponudbo in vas kontaktiral. Številka vašega povpraševanja:',
    newOne: 'Novo povpraševanje', invalidSize: 'Mere so izven dovoljenega razpona', pcs: 'kos',
    errors: { invalid_email: 'Vnesite veljaven e-poštni naslov.', name_required: 'Vnesite ime in priimek.', rate_limited: 'Preveč povpraševanj v kratkem času. Poskusite kasneje.', size_out_of_range: 'Nekatere mere so izven dovoljenega razpona.' } as Record<string, string>,
    genericError: 'Pošiljanje ni uspelo. Poskusite znova.',
  },
  en: {
    title: 'Window configurator', notFound: 'Configurator not available.', notFoundHint: 'The link is wrong or the supplier has not enabled it yet.',
    step1: 'Window type', step2: 'Profile system', step3: 'Size and opening', step4: 'Equipment',
    width: 'Width', height: 'Height', range: 'allowed', hinge: 'Hinge side (seen from inside)', qty: 'Quantity', label: 'Room (optional)', labelPh: 'e.g. living room',
    none: 'None', yourOrder: 'Your enquiry', position: 'Position', addWindow: 'Add window', duplicate: 'Duplicate', remove: 'Remove',
    unit: 'price/pc', total: 'Total excl. VAT', vat: 'VAT', gross: 'Total incl. VAT', estimate: 'Estimated price. The final quote follows an on-site measurement.',
    noPrice: 'Price after measurement', pricesHidden: 'You will receive the price in the quote by e-mail.',
    next: 'Continue to details', back: 'Back to windows', send: 'Send enquiry', sending: 'Sending …',
    contact: 'Your details', firstName: 'First name', lastName: 'Last name', email: 'E-mail', phone: 'Phone', address: 'Site address', note: 'Note',
    consent: 'I agree that the supplier uses my data to prepare a quote.',
    doneTitle: 'Thank you, your enquiry was sent!', doneText: 'The supplier will prepare a quote and contact you. Your enquiry number:',
    newOne: 'New enquiry', invalidSize: 'Size is outside the allowed range', pcs: 'pc',
    errors: { invalid_email: 'Enter a valid e-mail address.', name_required: 'Enter your first and last name.', rate_limited: 'Too many enquiries in a short time. Try again later.', size_out_of_range: 'Some sizes are outside the allowed range.' } as Record<string, string>,
    genericError: 'Sending failed. Please try again.',
  },
}

let seq = 0
const newKey = () => `i${++seq}`

export default function ConfiguratorPage() {
  const { slug } = useParams()
  const { lang, setLang } = useLanguage()
  const T = TXT[lang]
  const L = WL[lang]
  const [data, setData] = useState<ConfigData | null>(null)
  const [state, setState] = useState<'loading' | 'missing' | 'ready'>('loading')
  const [items, setItems] = useState<Item[]>([])
  const [active, setActive] = useState(0)
  const [stage, setStage] = useState<'config' | 'contact' | 'done'>('config')
  const [contact, setContact] = useState({ first_name: '', last_name: '', email: '', phone: '', address: '', note: '' })
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ quote_number: string } | null>(null)

  useEffect(() => {
    (supabase as any).rpc('get_configurator', { p_slug: slug }).then(({ data, error }: { data: ConfigData | null; error: unknown }) => {
      if (error || !data || !data.types.length || !data.systems.length) { setState('missing'); return }
      setData(data)
      setItems([defaultItem(data)])
      setState('ready')
      document.title = `${T.title} · ${data.company.name}`
    })
  }, [slug])

  const accent = data?.company.accent || '#101112'
  const cur = data?.company.currency || 'EUR'
  const show = !!data?.company.show_prices

  function defaultItem(d: ConfigData, typeId?: string): Item {
    const type = d.types.find(t => t.id === typeId) ?? d.types.find(t => t.template === 'tilt_turn') ?? d.types[0]
    const sys = d.systems.find(s => d.combos.some(c => c.system_id === s.id && c.type_id === type.id)) ?? d.systems[0]
    const door = type.template.startsWith('door') || type.template === 'lift_slide'
    return {
      key: newKey(), type_id: type.id, system_id: sys.id,
      width: clamp(door ? 900 : 1200, type.min_width, type.max_width),
      height: clamp(door ? 2200 : 1400, type.min_height, type.max_height),
      hinge: 'left', quantity: 1, label: '',
      option_ids: d.options.filter(o => o.is_default && SINGLE_CHOICE_GROUPS.includes(o.group_key)).map(o => o.id),
    }
  }

  function priceOf(it: Item): number | null {
    if (!data || !show || !it.width || !it.height) return null
    const p = data.prices.find(x => x.system_id === it.system_id && x.type_id === it.type_id)
    const base = basePrice(p, it.width, it.height)
    return unitPrice(base, it.width, it.height, data.options.filter(o => it.option_ids.includes(o.id)))
  }
  function sizeOk(it: Item) {
    const t = data?.types.find(x => x.id === it.type_id)
    return !!t && !!it.width && !!it.height && it.width >= t.min_width && it.width <= t.max_width && it.height >= t.min_height && it.height <= t.max_height
  }

  const totals = useMemo(() => {
    const net = items.reduce((a, it) => a + (priceOf(it) ?? 0) * it.quantity, 0)
    const vatRate = data?.company.vat_rate ?? 22
    const vat = Math.round(net * vatRate) / 100
    return { net, vat, gross: net + vat, vatRate, complete: items.every(it => priceOf(it) != null) }
  }, [items, data])

  if (state === 'loading') return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  if (state === 'missing' || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
      <div><p className="text-base font-medium text-gray-900">{T.notFound}</p><p className="text-sm text-gray-500 mt-1">{T.notFoundHint}</p></div>
    </div>
  )

  const it = items[active] ?? items[0]
  const type = data.types.find(t => t.id === it.type_id)!
  const allowedSystems = data.systems.filter(s => data.combos.some(c => c.system_id === s.id && c.type_id === type.id))
  const update = (patch: Partial<Item>) => setItems(xs => xs.map((x, i) => i === active ? { ...x, ...patch } : x))

  function pickType(t: WindowType) {
    const keepSystem = data!.combos.some(c => c.system_id === it.system_id && c.type_id === t.id)
    const d = defaultItem(data!, t.id)
    update({ type_id: t.id, system_id: keepSystem ? it.system_id : d.system_id, width: clamp(it.width ?? d.width!, t.min_width, t.max_width), height: d.height })
  }
  function toggleOption(o: WindowOption) {
    const single = SINGLE_CHOICE_GROUPS.includes(o.group_key)
    const sameGroup = data!.options.filter(x => x.group_key === o.group_key).map(x => x.id)
    if (single) update({ option_ids: [...it.option_ids.filter(id => !sameGroup.includes(id)), o.id] })
    else update({ option_ids: it.option_ids.includes(o.id) ? it.option_ids.filter(id => id !== o.id) : [...it.option_ids, o.id] })
  }
  function addItem(copy = false) {
    const next = copy ? { ...it, key: newKey(), option_ids: [...it.option_ids] } : defaultItem(data!)
    setItems(xs => [...xs, next]); setActive(items.length)
  }
  function removeItem(i: number) {
    if (items.length === 1) return
    setItems(xs => xs.filter((_, j) => j !== i)); setActive(a => Math.max(0, a >= i ? a - 1 : a))
  }

  async function submit() {
    setError('')
    if (!consent) return
    setSending(true)
    const { data: res, error } = await (supabase as any).rpc('submit_configuration', {
      p_slug: slug,
      p_customer: contact,
      p_items: items.map(x => ({ system_id: x.system_id, type_id: x.type_id, width: x.width, height: x.height, quantity: x.quantity, hinge: x.hinge, option_ids: x.option_ids, label: x.label })),
      p_note: contact.note,
    })
    setSending(false)
    if (error) {
      const code = Object.keys(T.errors).find(k => String(error.message).includes(k))
      setError(code ? T.errors[code] : T.genericError)
      return
    }
    setResult(res); setStage('done'); window.scrollTo({ top: 0 })
  }

  const p = priceOf(it)
  const btn = { backgroundColor: accent }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {data.company.logo_url
              ? <img src={data.company.logo_url} alt="" className="h-8 w-auto max-w-[140px] object-contain" />
              : <div className="w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-semibold" style={btn}>{data.company.name.charAt(0)}</div>}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{data.company.name}</div>
              <div className="text-xs text-gray-500">{T.title}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {data.company.phone && <a href={`tel:${data.company.phone}`} className="hidden sm:flex items-center gap-1 hover:text-gray-900"><Phone className="w-3.5 h-3.5" />{data.company.phone}</a>}
            {data.company.email && <a href={`mailto:${data.company.email}`} className="hidden md:flex items-center gap-1 hover:text-gray-900"><Mail className="w-3.5 h-3.5" />{data.company.email}</a>}
            <div className="flex rounded border border-gray-200 overflow-hidden">
              {(['sl', 'en'] as const).map(l => <button key={l} onClick={() => setLang(l)} className={cn('px-1.5 py-0.5 uppercase', lang === l ? 'bg-gray-900 text-white' : 'bg-white')}>{l}</button>)}
            </div>
          </div>
        </div>
      </header>

      {stage === 'done' ? (
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white mb-4" style={btn}><Check className="w-6 h-6" /></div>
          <h1 className="text-xl font-semibold text-gray-900">{T.doneTitle}</h1>
          <p className="text-sm text-gray-600 mt-2">{T.doneText}</p>
          <p className="text-lg font-semibold text-gray-900 mt-2">{result?.quote_number}</p>
          <button onClick={() => { setItems([defaultItem(data)]); setActive(0); setStage('config'); setConsent(false); setContact(c => ({ ...c, note: '' })) }}
            className="mt-6 text-sm font-medium hover:underline" style={{ color: accent }}>{T.newOne}</button>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-4 py-5 grid lg:grid-cols-[1fr_340px] gap-5 items-start">
          {/* Main column */}
          <div className="space-y-4 min-w-0">
            {stage === 'config' && data.company.intro && <p className="text-sm text-gray-600 whitespace-pre-line">{data.company.intro}</p>}

            {stage === 'config' ? <>
              {/* Position tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {items.map((x, i) => <button key={x.key} onClick={() => setActive(i)}
                  className={cn('shrink-0 px-3 py-1.5 rounded-full text-sm border', i === active ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400')}
                  style={i === active ? btn : undefined}>
                  {T.position} {i + 1}{x.label ? ` · ${x.label}` : ''}
                </button>)}
                <button onClick={() => addItem(false)} className="shrink-0 px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-200 text-gray-600 hover:border-gray-500 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />{T.addWindow}</button>
              </div>

              <Section n={1} title={T.step1} accent={accent}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {data.types.map(t => {
                    const door = t.template.startsWith('door') || t.template === 'lift_slide'
                    return <button key={t.id} onClick={() => pickType(t)}
                      className={cn('rounded-lg border p-3 text-left bg-white transition-colors', it.type_id === t.id ? 'ring-2' : 'border-gray-200 hover:border-gray-400')}
                      style={it.type_id === t.id ? { borderColor: accent, ['--tw-ring-color' as string]: accent } : undefined}>
                      <div className="h-[84px] flex items-center justify-center"><WindowDrawing template={t.template} width={door ? 900 : 1200} height={door ? 2100 : 1300} size={78} /></div>
                      <div className="text-xs font-medium text-gray-900 mt-2 leading-snug">{t.name}</div>
                    </button>
                  })}
                </div>
              </Section>

              <Section n={2} title={T.step2} accent={accent}>
                <div className="grid sm:grid-cols-2 gap-2">
                  {allowedSystems.map(s => <button key={s.id} onClick={() => update({ system_id: s.id })}
                    className={cn('rounded-lg border p-3 text-left bg-white', it.system_id === s.id ? 'ring-2' : 'border-gray-200 hover:border-gray-400')}
                    style={it.system_id === s.id ? { borderColor: accent, ['--tw-ring-color' as string]: accent } : undefined}>
                    <div className="flex items-center gap-2"><span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{L.materials[s.material]}</span><span className="text-sm font-medium text-gray-900">{s.name}</span></div>
                    {s.description && <div className="text-xs text-gray-500 mt-1">{s.description}</div>}
                  </button>)}
                </div>
              </Section>

              <Section n={3} title={T.step3} accent={accent}>
                <div className="grid sm:grid-cols-2 gap-3">
                  <MmInput label={T.width} value={it.width} onChange={v => update({ width: v })} min={type.min_width} max={type.max_width} rangeLabel={T.range} />
                  <MmInput label={T.height} value={it.height} onChange={v => update({ height: v })} min={type.min_height} max={type.max_height} rangeLabel={T.range} />
                  {hasHingeChoice(type.template) && <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">{T.hinge}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['left', 'right'] as Hinge[]).map(h => <button key={h} onClick={() => update({ hinge: h })}
                        className={cn('rounded-lg border px-3 py-2 text-sm bg-white', it.hinge === h ? 'text-white border-transparent' : 'border-gray-200 text-gray-700 hover:border-gray-400')}
                        style={it.hinge === h ? btn : undefined}>{L.hinge[h]}</button>)}
                    </div>
                  </div>}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">{T.qty}</label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => update({ quantity: Math.max(1, it.quantity - 1) })} className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-700">−</button>
                      <input type="number" min={1} max={100} value={it.quantity} onChange={e => update({ quantity: clamp(Number(e.target.value) || 1, 1, 100) })}
                        className="w-16 h-9 text-center rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2" />
                      <button onClick={() => update({ quantity: Math.min(100, it.quantity + 1) })} className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-700">+</button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-xs font-medium text-gray-500">{T.label}</label>
                    <input value={it.label} onChange={e => update({ label: e.target.value.slice(0, 60) })} placeholder={T.labelPh}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2" />
                  </div>
                </div>
              </Section>

              {data.options.length > 0 && <Section n={4} title={T.step4} accent={accent}>
                <div className="space-y-4">
                  {OPTION_GROUPS.filter(g => data.options.some(o => o.group_key === g)).map(g => <OptionGroupPicker key={g} group={g} title={L.groups[g]}
                    options={data.options.filter(o => o.group_key === g)} selected={it.option_ids} onToggle={toggleOption}
                    onClear={() => update({ option_ids: it.option_ids.filter(id => !data.options.some(o => o.group_key === g && o.id === id)) })}
                    accent={accent} show={show} currency={cur} noneLabel={T.none} pricingLabels={L.pricing} />)}
                </div>
              </Section>}

              <div className="flex gap-2">
                <button onClick={() => addItem(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-400"><Copy className="w-4 h-4" />{T.duplicate}</button>
                {items.length > 1 && <button onClick={() => removeItem(active)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:text-red-600 hover:border-red-200"><Trash2 className="w-4 h-4" />{T.remove}</button>}
              </div>
            </> : (
              /* Contact stage */
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <button onClick={() => setStage('config')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="w-4 h-4" />{T.back}</button>
                <h2 className="text-base font-semibold text-gray-900 mb-4">{T.contact}</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label={T.firstName} value={contact.first_name} onChange={v => setContact({ ...contact, first_name: v })} autoComplete="given-name" />
                  <Field label={T.lastName} value={contact.last_name} onChange={v => setContact({ ...contact, last_name: v })} autoComplete="family-name" />
                  <Field label={T.email} type="email" value={contact.email} onChange={v => setContact({ ...contact, email: v })} autoComplete="email" />
                  <Field label={T.phone} type="tel" value={contact.phone} onChange={v => setContact({ ...contact, phone: v })} autoComplete="tel" />
                  <div className="sm:col-span-2"><Field label={T.address} value={contact.address} onChange={v => setContact({ ...contact, address: v })} autoComplete="street-address" /></div>
                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">{T.note}</label>
                    <textarea rows={3} value={contact.note} onChange={e => setContact({ ...contact, note: e.target.value.slice(0, 2000) })}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2" />
                  </div>
                </div>
                <label className="flex items-start gap-2 mt-4 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" style={{ accentColor: accent }} />
                  {T.consent}
                </label>
                {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
              </div>
            )}
          </div>

          {/* Summary column */}
          <aside className="lg:sticky lg:top-4 space-y-3">
            {stage === 'config' && <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex justify-center py-2 overflow-hidden">
                <WindowDrawing template={type.template} width={it.width ?? 0} height={it.height ?? 0} hinge={it.hinge} size={220} showDims />
              </div>
              {!sizeOk(it) && <p className="text-xs text-red-600 text-center mt-1">{T.invalidSize}</p>}
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-xs text-gray-500">{T.unit}</span>
                <span className="text-lg font-semibold text-gray-900">{show ? (p != null ? money(p, cur) : T.noPrice) : '—'}</span>
              </div>
            </div>}

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-gray-900 mb-2">{T.yourOrder}</div>
              <ul className="divide-y divide-gray-100">
                {items.map((x, i) => {
                  const t = data.types.find(tt => tt.id === x.type_id)
                  const xp = priceOf(x)
                  return <li key={x.key}>
                    <button onClick={() => { setActive(i); setStage('config') }} className="w-full flex items-center gap-3 py-2 text-left">
                      <div className="w-10 flex justify-center shrink-0">{t && <WindowDrawing template={t.template} width={x.width ?? 0} height={x.height ?? 0} hinge={x.hinge} size={36} />}</div>
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-sm truncate', i === active && stage === 'config' ? 'font-semibold text-gray-900' : 'text-gray-700')}>{x.quantity} × {t?.name}</div>
                        <div className="text-xs text-gray-500">{x.width} × {x.height} mm{x.label ? ` · ${x.label}` : ''}</div>
                      </div>
                      {show && <div className="text-sm text-gray-900 whitespace-nowrap">{xp != null ? money(xp * x.quantity, cur) : '—'}</div>}
                    </button>
                  </li>
                })}
              </ul>
              {show ? <div className="border-t border-gray-200 mt-2 pt-2 space-y-1 text-sm">
                <Row l={T.total} r={money(totals.net, cur)} />
                {totals.vatRate > 0 && <Row l={`${T.vat} ${totals.vatRate} %`} r={money(totals.vat, cur)} muted />}
                <Row l={T.gross} r={money(totals.gross, cur)} bold />
                <p className="text-xs text-gray-400 pt-1">{T.estimate}</p>
              </div> : <p className="text-xs text-gray-500 border-t border-gray-200 mt-2 pt-2">{T.pricesHidden}</p>}

              {stage === 'config' ? (
                <button disabled={!items.every(sizeOk)} onClick={() => { setStage('contact'); window.scrollTo({ top: 0 }) }}
                  className="mt-3 w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50" style={btn}>{T.next}</button>
              ) : (
                <button disabled={sending || !consent || !contact.email || !(contact.first_name || contact.last_name)} onClick={submit}
                  className="mt-3 w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2" style={btn}>
                  {sending && <Loader2 className="w-4 h-4 animate-spin" />}{sending ? T.sending : T.send}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)) }

function Section({ n, title, accent, children }: { n: number; title: string; accent: string; children: React.ReactNode }) {
  return <section className="bg-white border border-gray-200 rounded-xl p-4">
    <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
      <span className="w-5 h-5 rounded-full text-[11px] text-white flex items-center justify-center" style={{ backgroundColor: accent }}>{n}</span>{title}
    </h2>
    {children}
  </section>
}

function MmInput({ label, value, onChange, min, max, rangeLabel }: { label: string; value: number | null; onChange: (v: number | null) => void; min: number; max: number; rangeLabel: string }) {
  const bad = value != null && (value < min || value > max)
  return <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-gray-500">{label}</label>
    <div className={cn('flex items-center rounded-lg border bg-white', bad ? 'border-red-400' : 'border-gray-200')}>
      <input type="number" inputMode="numeric" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Math.round(Number(e.target.value)))}
        className="flex-1 min-w-0 px-3 py-2 text-sm bg-transparent focus:outline-none" />
      <span className="px-3 text-sm text-gray-400 border-l border-gray-200">mm</span>
    </div>
    <span className={cn('text-xs', bad ? 'text-red-600' : 'text-gray-400')}>{rangeLabel} {min}–{max} mm</span>
  </div>
}

function Field({ label, value, onChange, type = 'text', autoComplete }: { label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string }) {
  return <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-gray-500">{label}</label>
    <input type={type} value={value} autoComplete={autoComplete} onChange={e => onChange(e.target.value.slice(0, 200))}
      className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2" />
  </div>
}

function Row({ l, r, bold, muted }: { l: string; r: string; bold?: boolean; muted?: boolean }) {
  return <div className={cn('flex justify-between', bold && 'font-semibold text-gray-900', muted && 'text-gray-500')}><span>{l}</span><span>{r}</span></div>
}

function OptionGroupPicker({ group, title, options, selected, onToggle, onClear, accent, show, currency, noneLabel, pricingLabels }: {
  group: OptionGroup; title: string; options: WindowOption[]; selected: string[]; onToggle: (o: WindowOption) => void; onClear: () => void
  accent: string; show: boolean; currency: string; noneLabel: string; pricingLabels: Record<string, string>
}) {
  const single = SINGLE_CHOICE_GROUPS.includes(group)
  const price = (o: WindowOption) => {
    if (!show || o.price == null || Number(o.price) === 0) return null
    return o.pricing === 'percent' ? `+${Number(o.price).toLocaleString('de-DE')} %` : `+${money(Number(o.price), currency)}${o.pricing === 'm2' ? ' / m²' : ''}`
  }
  const anySelected = options.some(o => selected.includes(o.id))
  return <div>
    <div className="text-xs font-medium text-gray-500 mb-1.5">{title}</div>
    <div className="flex flex-wrap gap-2">
      {!single && <Chip on={!anySelected} onClick={onClear} accent={accent} single>{noneLabel}</Chip>}
      {options.map(o => <Chip key={o.id} on={selected.includes(o.id)} onClick={() => onToggle(o)} accent={accent} single={single}>
        {o.name}{price(o) && <span className="ml-1.5 opacity-70">{price(o)}</span>}
      </Chip>)}
    </div>
    {void pricingLabels}
  </div>
}

function Chip({ on, onClick, accent, single, children }: { on: boolean; onClick: () => void; accent: string; single?: boolean; children: React.ReactNode }) {
  return <button onClick={onClick}
    className={cn('px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1.5', on ? 'bg-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400')}
    style={on ? { borderColor: accent, color: accent, boxShadow: `inset 0 0 0 1px ${accent}` } : undefined}>
    {on && !single && <Check className="w-3.5 h-3.5" />}{children}
  </button>
}
