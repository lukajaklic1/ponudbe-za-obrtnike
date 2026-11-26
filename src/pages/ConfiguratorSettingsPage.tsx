import { useRef, useState } from 'react'
import { trimImage } from '../lib/trimImage'
import { THEME_FONTS, THEME_DEFAULTS } from '../lib/configuratorTheme'
import { Navigate } from 'react-router-dom'
import { Globe, ExternalLink, Copy, Upload, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import Button from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { cn } from '../lib/cn'
import { SI_AREAS, DEFAULT_AREA, normalizeAreas, type InstallArea } from '../lib/siPosts'
const TXT = {
  sl: {
    title: 'Objava', save: 'Shrani', saved: 'Shranjeno.',
    logo: 'Logotip', uploadLogo: 'Naloži logotip', replaceLogo: 'Zamenjaj logotip', uploading: 'Nalagam…', removeLogo: 'Odstrani',
    logoHint: 'Logotip se prikaže na vrhu strani. PNG, JPG, SVG ali WEBP, največ 2 MB.',
    noLogoHint: 'Brez logotipa se stranki prikaže logotip Fenestio. PNG, JPG, SVG ali WEBP, največ 2 MB.',
    logoSize: 'Velikost logotipa', logoSizes: { s: 'Majhen', m: 'Srednji', l: 'Velik' } as Record<string, string>,
    modeTitle: 'Nastavitve delovanja konfiguratorja', modeHint: 'Izberite eno od spodnjih opcij, ki bo definirala delovanje vašega konfiguratorja.',
    combos: [
      ['live', 'pdf', 'Sprotne cene, ponudba takoj', 'Stranka med konfiguracijo vidi cene. Po konfiguraciji lahko takoj prenese ponudbo.'],
      ['never', 'pdf', 'Brez cen, ponudba takoj', 'Stranka med konfiguracijo ne vidi cen. Po konfiguraciji lahko takoj prenese ponudbo.'],
      ['live', 'enquiry', 'Sprotne cene, povpraševanje', 'Stranka med konfiguracijo vidi cene. Po konfiguraciji pošlje povpraševanje. Vi povpraševanje potrdite, izdate ponudbo in jo pošljete stranki.'],
      ['never', 'enquiry', 'Brez cen, povpraševanje', 'Stranka med konfiguracijo ne vidi cen. Po konfiguraciji pošlje povpraševanje. Vi povpraševanje potrdite, izdate ponudbo in jo pošljete stranki.'],
    ] as [string, string, string, string][],
    areaSi: 'Izberite regije, v katerih izvajate montažo. Če ne izberete nobene, velja vsa Slovenija. Stranka izven območja lahko pošlje povpraševanje brez montaže.',
    cfgSlug: 'Naslov strani',
    cfgAccent: 'Barva gumbov', copy: 'Kopiraj', copied: 'Kopirano',
    open: 'Odpri', slugInvalid: 'Naslov: 3–40 znakov, male črke, številke in vezaji',
    slugTaken: 'Ta naslov je že zaseden', slugChangeHint: 'Ko naslov spremenite in shranite, stara povezava preneha delovati.§Konfigurator je dostopen na novi povezavi.',
    status: 'Stanje konfiguratorja', published: 'Objavljen', notPublished: 'Ni objavljen',
    publishedHint: 'Stranke lahko dostopajo do konfiguratorja prek spodnje povezave, kjer lahko oddajo povpraševanje ali pridobijo ponudbo.',
    notPublishedHint: 'Vaš konfigurator ni objavljen. Stranke ga na povezavi ne vidijo.',
  },
  en: {
    title: 'Publishing', save: 'Save', saved: 'Saved.',
    logo: 'Logo', uploadLogo: 'Upload logo', replaceLogo: 'Replace logo', uploading: 'Uploading…', removeLogo: 'Remove',
    logoHint: 'The logo is shown at the top of the page. PNG, JPG, SVG or WEBP, max 2 MB.',
    noLogoHint: 'Without a logo customers see the Fenestio logo. PNG, JPG, SVG or WEBP, max 2 MB.',
    logoSize: 'Logo size', logoSizes: { s: 'Small', m: 'Medium', l: 'Large' } as Record<string, string>,
    modeTitle: 'How the configurator works for customers', modeHint: 'Choose one of the options below to define your configurator.',
    combos: [
      ['live', 'pdf', 'Live prices, quote right away', 'The customer sees prices while configuring. After configuring they can download the quote right away.'],
      ['never', 'pdf', 'No prices, quote right away', 'The customer does not see prices while configuring. After configuring they can download the quote right away.'],
      ['live', 'enquiry', 'Live prices, enquiry', 'The customer sees prices while configuring. After configuring they send an enquiry. You confirm the enquiry, issue a quote and send it to the customer.'],
      ['never', 'enquiry', 'No prices, enquiry', 'The customer does not see prices while configuring. After configuring they send an enquiry. You confirm the enquiry, issue a quote and send it to the customer.'],
    ] as [string, string, string, string][],
    areaSi: 'Choose the regions where you install. If none is chosen, all of Slovenia applies. A customer outside the area can still send an enquiry without installation.',
    cfgSlug: 'Page address',
    cfgAccent: 'Button colour', copy: 'Copy', copied: 'Copied',
    open: 'Open', slugInvalid: 'Address: 3–40 chars, lowercase letters, digits and dashes',
    slugTaken: 'This address is already taken', slugChangeHint: 'Once you change the address and save, the old link stops working.§The configurator is available at the new link.',
    status: 'Configurator status', published: 'Published', notPublished: 'Not published',
    publishedHint: 'Customers can use the link below to open the configurator, send an enquiry or get a quote.',
    notPublishedHint: 'Your configurator is not published. Customers cannot see it at the link.',
  },
}
type TT = typeof TXT['sl']
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('bg-white border border-gray-200 rounded-xl', className)}>{children}</div>
}
/** Settings of the public window configurator: switch it on, its address, prices, colour and intro text. */

export default function ConfiguratorSettingsPage() {
  const { company, hasPerm, loading, refetch } = useCompany()
  const { lang } = useLanguage()
  const T = TXT[lang]
  if (loading) return null
  if (!hasPerm('price_list', 'view')) return <Navigate to="/dashboard" replace />
  return <div>
    <PageHeader title={T.title} icon={Globe} />
    {company && <ConfiguratorSettings T={T} canEdit={hasPerm('price_list', 'create')} company={company} onSaved={refetch} />}
  </div>
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

function ConfiguratorSettings({ T, canEdit, company, onSaved }: { T: TT; canEdit: boolean; company: NonNullable<ReturnType<typeof useCompany>['company']>; onSaved: () => void }) {
  const [form, setForm] = useState({
    enabled: company.configurator_enabled ?? false,
    slug: company.configurator_slug ?? slugify(company.name),
    // how the configurator works for the customer
    priceMode: ((company as any).configurator_price_mode as string | null) ?? (company.configurator_show_prices === false ? 'never' : 'live'),
    endMode: ((company as any).configurator_end_mode as string | null) ?? 'pdf',
    logoSize: ((company as any).configurator_logo_size as string | null) ?? 'm',
    accent: company.configurator_accent ?? '#2563eb',
    intro: company.configurator_intro ?? '',
    area: (() => { const a = ((company as any).configurator_area as InstallArea | null) ?? DEFAULT_AREA; return { ...a, si_areas: normalizeAreas(a.si_areas ?? []) } })(),
    theme: ((company as any).configurator_theme as Record<string, string> | null) ?? {},
  })
  const { lang } = useLanguage()
  const [saving, setSaving] = useState<string | null>(null)
  // the logo is the company logo (same as in Settings); an upload or removal is saved at once
  const [logoUrl, setLogoUrl] = useState<string | null>(company.logo_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const logoInput = useRef<HTMLInputElement>(null)
  async function deleteLogoFiles(keep?: string) {
    const { data } = await supabase.storage.from('logos').list(company.id)
    const old = (data ?? []).filter((f: { name: string }) => f.name.startsWith('logo-')).map((f: { name: string }) => `${company.id}/${f.name}`).filter((p: string) => p !== keep)
    if (old.length) await supabase.storage.from('logos').remove(old)
  }
  async function uploadLogo(original: File) {
    if (original.size > 2 * 1024 * 1024) { toast.error('Max 2 MB'); return }
    setUploading(true)
    const file = await trimImage(original)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${company.id}/logo-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { setUploading(false); toast.error(upErr.message); return }
    const url = supabase.storage.from('logos').getPublicUrl(path).data.publicUrl
    const { error } = await supabase.from('companies').update({ logo_url: url, updated_at: new Date().toISOString() }).eq('id', company.id)
    setUploading(false)
    if (error) { toast.error(error.message); return }
    setLogoUrl(url); toast.success(T.saved); onSaved()
    await deleteLogoFiles(path)
  }
  async function removeLogo() {
    const { error } = await supabase.from('companies').update({ logo_url: null, updated_at: new Date().toISOString() }).eq('id', company.id)
    if (error) { toast.error(error.message); return }
    setLogoUrl(null); onSaved()
    await deleteLogoFiles()
  }
  // a value equal to null/default is removed so only real changes are stored
  const setThemeValue = (k: string, v: string | null) => setForm(f => { const t = { ...f.theme }; if (v === null || (k === 'font' ? v === 'default' : v.toLowerCase() === (THEME_DEFAULTS as Record<string, string>)[k])) delete t[k]; else t[k] = v; return { ...f, theme: t } })
  const slugOk = /^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$/.test(form.slug)

  // each card saves only its own settings
  async function save(part: 'status' | 'mode' | 'look' | 'area') {
    if (part === 'status' && !slugOk) { toast.error(T.slugInvalid); return }
    const patch: Record<string, unknown> =
      part === 'status' ? { configurator_enabled: form.enabled, configurator_slug: form.slug }
      : part === 'mode' ? {
        configurator_price_mode: form.priceMode, configurator_end_mode: form.endMode,
        // the page needs the prices unless they are never shown and only an enquiry is sent
        configurator_show_prices: !(form.priceMode === 'never' && form.endMode === 'enquiry'),
      }
      : part === 'look' ? {
        configurator_logo_size: form.logoSize, configurator_accent: form.accent,
        // only what differs from the default is stored; nothing changed = null
        configurator_theme: Object.keys(form.theme).length ? form.theme : null,
      }
      : { configurator_area: form.area }
    setSaving(part)
    const { error } = await supabase.from('companies').update(patch as any).eq('id', company.id)
    setSaving(null)
    if (error) { toast.error(error.code === '23505' ? T.slugTaken : error.message); return }
    toast.success(T.saved); onSaved()
  }
  function copy(text: string) { navigator.clipboard.writeText(text).then(() => toast.success(T.copied)) }
  // the link that works right now (the saved address); changes of the address and of published/hidden are applied with Save
  const savedSlug = company.configurator_slug ?? ''
  const savedUrl = `${window.location.origin}/k/${savedSlug}`

  return <div className="form-scope px-6 py-6 max-w-3xl mx-auto space-y-4">
    <Card className="p-5 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[240px]">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">{T.status}</h2>
          <span className={form.enabled ? 'inline-flex items-center h-[22px] px-2 rounded-md text-xs font-medium bg-[#dbfce7] text-[#267a47]' : 'inline-flex items-center h-[22px] px-2 rounded-md text-xs font-medium bg-[#eeeff1] text-[#52525b]'}>{form.enabled ? T.published : T.notPublished}</span>
        </div>
        <p className="text-sm font-medium text-[#5e5e5e] mt-1">{form.enabled ? T.publishedHint : T.notPublishedHint}</p>
      </div>
      {canEdit && <div className="inline-flex p-1 rounded-[10px] bg-[#f1f1f1] w-fit">
        {([true, false] as const).map(on => <button key={String(on)} type="button" onClick={() => setForm(f => ({ ...f, enabled: on }))}
          className={cn('h-9 px-4 rounded-lg text-sm font-semibold transition-colors', form.enabled === on ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.1)]' : 'text-[#5e5e5e] hover:text-gray-900')}>
          {on ? T.published : T.notPublished}</button>)}
      </div>}
      <div className="basis-full flex flex-wrap items-center gap-2">
        <div className={cn('flex-1 min-w-0 flex items-center rounded-lg border bg-gray-50 text-sm overflow-hidden', slugOk ? 'border-gray-200' : 'border-red-400')}>
          <span className="pl-3 text-[#7f7f7f] shrink-0 hidden sm:inline">{window.location.origin}/k/</span>
          <input value={form.slug} disabled={!canEdit} onChange={e => setForm({ ...form, slug: slugify(e.target.value) })} aria-label={T.cfgSlug}
            className="flex-1 min-w-0 bg-transparent px-1 sm:pl-0 sm:pr-3 py-2 text-gray-900 font-medium focus:outline-none" />
        </div>
        {savedSlug && <>
          <Button variant="secondary" className="gap-1.5" onClick={() => copy(savedUrl)}><Copy className="w-4 h-4" />{T.copy}</Button>
          <a href={savedUrl} target="_blank" rel="noreferrer"><Button variant="secondary" className="gap-1.5"><ExternalLink className="w-4 h-4" />{T.open}</Button></a>
        </>}
        {!slugOk && <p className="basis-full text-xs font-medium text-red-600">{T.slugInvalid}</p>}
        {slugOk && savedSlug && form.slug !== savedSlug && <p className="basis-full text-xs font-medium text-[#7f7f7f]">{T.slugChangeHint.split("§").map((s: string) => <span key={s} className="block">{s}</span>)}</p>}
      </div>
      {canEdit && <div className="basis-full flex justify-end"><Button onClick={() => save('status')} loading={saving === 'status'}>{T.save}</Button></div>}
    </Card>

    <Card className="p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{T.modeTitle}</h2>
        <p className="text-sm font-medium text-[#5e5e5e] mt-1">{T.modeHint}</p>
      </div>
      <div className="grid gap-2">
        {T.combos.map(([pm, em, , hint]) => { const on = form.priceMode === pm && form.endMode === em
          return <button key={pm + em} type="button" disabled={!canEdit} onClick={() => setForm(f => ({ ...f, priceMode: pm, endMode: em }))}
            className={cn('text-left rounded-xl border px-4 py-3 transition-colors', on ? 'border-[#266df0] bg-[#eff5fe]' : 'border-gray-200 bg-white hover:border-gray-400')}>
            <div className="flex items-start gap-3">
              <span className={cn('w-4 h-4 mt-1 rounded-full border-2 shrink-0', on ? 'border-[#266df0] bg-[#266df0] shadow-[inset_0_0_0_2px_#fff]' : 'border-gray-300')} />
              <span className="text-sm leading-6 font-medium text-gray-900">{hint}</span>
            </div>
          </button> })}
      </div>
      {canEdit && <div className="flex justify-end"><Button onClick={() => save('mode')} loading={saving === 'mode'}>{T.save}</Button></div>}
    </Card>

    <Card className="p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Videz konfiguratorja</h2>
        <p className="text-sm font-medium text-[#5e5e5e] mt-1">Izberite logotip, barve in besedilo, ki jih stranke vidijo na vaši strani.</p>
      </div>
      <div className="flex flex-col gap-1">
        <label className="!font-semibold">{T.logo}</label>
        <p className="text-sm font-medium text-[#5e5e5e]">{logoUrl ? T.logoHint : T.noLogoHint}</p>
        <div className="flex items-center gap-3 mt-2"
          onDragOver={e => { if (!canEdit) return; e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (canEdit && f) uploadLogo(f) }}>
          <div className={cn('w-40 h-20 rounded-lg border bg-white flex items-center justify-center overflow-hidden shrink-0 transition-colors', dragOver ? 'border-[#266df0]' : 'border-gray-200')}
            style={logoUrl ? undefined : { backgroundImage: 'linear-gradient(45deg,#f4f4f5 25%,transparent 25%,transparent 75%,#f4f4f5 75%),linear-gradient(45deg,#f4f4f5 25%,transparent 25%,transparent 75%,#f4f4f5 75%)', backgroundSize: '12px 12px', backgroundPosition: '0 0,6px 6px' }}>
            {logoUrl ? <img src={logoUrl} alt="" className="max-w-full max-h-full object-contain p-2" /> : <ImageIcon className="w-5 h-5 text-gray-300" />}
          </div>
          {canEdit && <Button variant="secondary" className="gap-1.5" loading={uploading} onClick={() => logoInput.current?.click()}><Upload className="w-4 h-4" />{logoUrl ? T.replaceLogo : T.uploadLogo}</Button>}
          {logoUrl && canEdit && <button type="button" onClick={removeLogo} className="px-2.5 py-1.5 rounded-md text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50">{T.removeLogo}</button>}
        </div>
        <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="!font-semibold">{T.logoSize}</label>
        <div className="inline-flex p-1 rounded-[10px] bg-[#f1f1f1] w-fit mt-1">
          {(['s', 'm', 'l'] as const).map(k => <button key={k} type="button" disabled={!canEdit} onClick={() => setForm(f => ({ ...f, logoSize: k }))}
            className={cn('h-9 px-4 rounded-lg text-sm font-semibold transition-colors', form.logoSize === k ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.1)]' : 'text-[#5e5e5e] hover:text-gray-900')}>
            {T.logoSizes[k]}</button>)}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <label className="!font-semibold">Pisava in barve</label>
          {Object.keys(form.theme).length > 0 && <button type="button" disabled={!canEdit} onClick={() => setForm(f => ({ ...f, theme: {} }))} className="text-sm font-medium text-[#5e5e5e] hover:text-gray-900 underline">Ponastavi na privzeto</button>}
        </div>
        <p className="text-sm font-medium text-[#5e5e5e]">Kar ne spremenite, ostane privzeto.</p>
        <div className="flex flex-col gap-1 mt-1 sm:max-w-[calc((100%-1.5rem)/3)]">
          <span className="text-sm font-medium text-gray-900">Pisava</span>
          <select disabled={!canEdit} value={form.theme.font ?? 'default'} onChange={e => setThemeValue('font', e.target.value)} className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm">
            {THEME_FONTS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-2">
          {([['bg', 'Ozadje strani'], ['button', 'Gumbi in izbrane možnosti'], ['ink', 'Naslovi in glavno besedilo'], ['muted', 'Sivo besedilo'], ['border', 'Obrobe']] as const).map(([k, label]) => (
            <div key={k} className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-900">{label}</span>
              <div className="flex items-center gap-2">
                <input type="color" disabled={!canEdit} value={form.theme[k] ?? THEME_DEFAULTS[k]} onChange={e => setThemeValue(k, e.target.value)} className="h-9 w-12 rounded border border-gray-200 bg-white p-1" />
                <span className="text-sm font-medium text-[#5e5e5e]">{form.theme[k] ?? 'privzeto'}</span>
                {form.theme[k] && <button type="button" disabled={!canEdit} onClick={() => setThemeValue(k, null)} className="text-sm text-[#5e5e5e] hover:text-gray-900 underline">ponastavi</button>}
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-900">{T.cfgAccent}</span>
            <div className="flex items-center gap-2">
              <input type="color" disabled={!canEdit} value={form.accent} onChange={e => setForm({ ...form, accent: e.target.value })} className="h-9 w-12 rounded border border-gray-200 bg-white p-1" />
              <span className="text-sm font-medium text-[#5e5e5e]">{form.accent}</span>
            </div>
          </div>
        </div>
      </div>
      {canEdit && <div className="flex justify-end"><Button onClick={() => save('look')} loading={saving === 'look'}>{T.save}</Button></div>}
    </Card>

    <Card className="p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Območje montaže</h2>
        <p className="text-sm font-medium text-[#5e5e5e] mt-1">Izberite območje, kjer izvajate montažo.</p>
      </div>
      <div>
        <p className="text-sm font-medium text-[#5e5e5e] mb-3">{T.areaSi}</p>
        <div className="flex flex-wrap gap-2">
          {SI_AREAS.map(a => { const on = form.area.si_areas.includes(a.key)
            return <button key={a.key} type="button" disabled={!canEdit}
              onClick={() => setForm(f => ({ ...f, area: { ...f.area, countries: ['SI'], si_areas: on ? f.area.si_areas.filter(x => x !== a.key) : [...f.area.si_areas, a.key] } }))}
              className={cn('h-9 px-3.5 rounded-[10px] border text-sm font-medium transition-colors', on ? 'border-[#266df0] bg-[#eff5fe] text-gray-900' : 'border-gray-200 bg-white text-[#5e5e5e] hover:border-gray-400')}>{lang === 'en' ? a.en : a.sl}</button> })}
        </div>
      </div>
      {canEdit && <div className="flex justify-end"><Button onClick={() => save('area')} loading={saving === 'area'}>{T.save}</Button></div>}
    </Card>

  </div>
}
