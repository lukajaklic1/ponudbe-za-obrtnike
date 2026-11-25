import { useState } from 'react'
import { THEME_FONTS, THEME_DEFAULTS } from '../lib/configuratorTheme'
import { themeVars } from './ConfiguratorPage'
import { Navigate } from 'react-router-dom'
import { Globe, ExternalLink, Copy } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Checkbox from '../components/ui/Checkbox'
import { PageHeader } from '../components/ui/PageHeader'
import { cn } from '../lib/cn'
import { COUNTRIES, SI_AREAS, DEFAULT_AREA, type InstallArea } from '../lib/siPosts'

const TXT = {
  sl: {
    title: 'Objava', save: 'Shrani', saved: 'Shranjeno.',
    logoSize: 'Velikost logotipa', logoSizeHint: 'Logotip naložite v Nastavitvah; prazen rob okoli njega se obreže sam.', logoSizes: { s: 'Majhen', m: 'Srednji', l: 'Velik' } as Record<string, string>,
    modeTitle: 'Kako deluje konfigurator za stranke', modeHint: 'Izberite eno od spodnjih opcij, ki bo definirala vaš konfigurator.',
    combos: [
      ['live', 'pdf', 'Sprotne cene, ponudba takoj', 'Stranka med konfiguracijo vidi sprotne cene. Po konfiguraciji in oddaji osebnih podatkov sama prenese ponudbo (PDF), vi dobite obvestilo. Na seznamu ima status Ponudba prenesena.'],
      ['live', 'enquiry', 'Sprotne cene, povpraševanje', 'Stranka med konfiguracijo vidi sprotne cene. Po konfiguraciji in oddaji osebnih podatkov pošlje povpraševanje. Vi ponudbo pregledate, izdate in pošljete stranki.'],
      ['never', 'pdf', 'Brez cen, ponudba takoj', 'Stranka med konfiguracijo cen ne vidi. Po oddaji osebnih podatkov sama prenese ponudbo s cenami (PDF), vi dobite obvestilo.'],
      ['never', 'enquiry', 'Brez cen, povpraševanje', 'Stranka cen ne vidi. Po konfiguraciji in oddaji osebnih podatkov pošlje povpraševanje. Vi pripravite in pošljete ponudbo.'],
    ] as [string, string, string, string][],
    priceModeLabel: 'Kdaj stranka vidi cene?',
    priceModes: [
      ['live', 'Med izbiranjem', 'Ceno vidi že med konfiguriranjem, za okno in vsako opremo.'],
      ['end', 'Po vnosu podatkov', 'Med izbiranjem cen ne vidi. Ceno vidi, ko vpiše svoje podatke.'],
      ['range', 'Samo okvirno', 'Namesto cene vidi razpon, na primer od 820 do 980 €.'],
      ['never', 'Nikoli', 'Cen ne vidi. Pošlje samo povpraševanje.'],
    ] as [string, string, string][],
    endModeLabel: 'Kaj se zgodi, ko stranka odda podatke?',
    endModes: [
      ['enquiry', 'Pošlje se povpraševanje', 'Stranka pošlje povpraševanje, ponudbo ji pripravite in pošljete vi. Na seznamu ima status Povpraševanje.'],
      ['pdf', 'Ponudbo dobi takoj', 'Stranka po vnosu podatkov sama prenese ponudbo (PDF). Vi dobite obvestilo, na seznamu ima status Ponudba prenesena.'],
      ['choose', 'Stranka izbere', 'Stranka sama izbere: prenese ponudbo ali pošlje povpraševanje.'],
    ] as [string, string, string][],
    modeResult: (p: string, e: string) => e !== 'enquiry' && p === 'never'
      ? 'Stranka cen med izbiranjem ne vidi, na koncu pa prenese ponudbo s cenami.'
      : `Stranka ${p === 'live' ? 'vidi cene sproti' : p === 'end' ? 'vidi ceno šele na koncu' : p === 'range' ? 'vidi okvirni razpon cene' : 'cen ne vidi'}, na koncu ${e === 'enquiry' ? 'pošlje povpraševanje' : e === 'pdf' ? 'takoj prenese ponudbo' : 'izbere med ponudbo in povpraševanjem'}.`,
    area: 'Območje montaže', areaHint: 'Države, v katerih izvajate montažo. Stranka z naslovom izven območja lahko pošlje povpraševanje brez montaže.',
    areaSi: 'V Sloveniji samo ta poštna območja (brez izbire velja vsa Slovenija):',
    cfgEnabled: 'Konfigurator je javno dostopen', cfgSlug: 'Naslov strani', cfgShowPrices: 'Stranka lahko sproti vidi cene med konfiguracijo',
    cfgAccent: 'Barva gumbov', cfgIntro: 'Uvodno besedilo', cfgLink: 'Povezava do konfiguratorja', linkHint: 'Povezavo lahko dodate na gumb na vaši spletni strani (npr. »Izračunajte ceno«) ali jo pošljete stranki.', copy: 'Kopiraj', copied: 'Kopirano',
    open: 'Odpri', embed: 'Koda za vgradnjo v vašo spletno stran', embedHint: 'Če želite konfigurator prikazati kot del vaše spletne strani, kopirajte kodo in jo prilepite na stran (v WordPressu ali Wixu v blok HTML).', slugInvalid: 'Naslov: 3–40 znakov, male črke, številke in vezaji',
    slugTaken: 'Ta naslov je že zaseden',
    status: 'Stanje konfiguratorja', published: 'Objavljen', notPublished: 'Ni objavljen',
    publishedHint: 'Stranke lahko konfigurator odprejo na povezavi spodaj in vam pošljejo povpraševanje.',
    notPublishedHint: 'Vaš konfigurator ni objavljen. Stranke ga na povezavi ne vidijo.',
    publish: 'Objavi konfigurator', hide: 'Skrij konfigurator', publishedToast: 'Konfigurator je objavljen.', hiddenToast: 'Konfigurator je skrit.',
  },
  en: {
    title: 'Publishing', save: 'Save', saved: 'Saved.',
    logoSize: 'Logo size', logoSizeHint: 'Upload the logo in Settings; the empty margin around it is cut away.', logoSizes: { s: 'Small', m: 'Medium', l: 'Large' } as Record<string, string>,
    modeTitle: 'How the configurator works for customers', modeHint: 'Choose one of the options below to define your configurator.',
    combos: [
      ['live', 'pdf', 'Live prices, quote right away', 'The customer sees live prices while configuring. After configuring and entering their details they download the quote (PDF) themselves, you are notified. Status in the list: Offer downloaded.'],
      ['live', 'enquiry', 'Live prices, enquiry', 'The customer sees live prices while configuring. After entering their details they send an enquiry. You review, issue and send the quote.'],
      ['never', 'pdf', 'No prices, quote right away', 'The customer sees no prices while configuring. After entering their details they download the quote with prices (PDF), you are notified.'],
      ['never', 'enquiry', 'No prices, enquiry', 'The customer sees no prices. After configuring and entering their details they send an enquiry. You prepare and send the quote.'],
    ] as [string, string, string, string][],
    priceModeLabel: 'When does the customer see prices?',
    priceModes: [
      ['live', 'While choosing', 'They see the price while configuring, for the window and every extra.'],
      ['end', 'After entering details', 'No prices while choosing. They see the price once they enter their details.'],
      ['range', 'Estimate only', 'A range instead of the price, e.g. from 820 to 980 €.'],
      ['never', 'Never', 'No prices. They only send an enquiry.'],
    ] as [string, string, string][],
    endModeLabel: 'What happens when the customer submits their details?',
    endModes: [
      ['enquiry', 'An enquiry is sent', 'The customer sends an enquiry and you prepare and send the quote. Status in the list: Enquiry.'],
      ['pdf', 'They get the quote right away', 'After entering details the customer downloads the quote (PDF) themselves. You are notified, status: Offer downloaded.'],
      ['choose', 'The customer chooses', 'The customer picks: download the quote or send an enquiry.'],
    ] as [string, string, string][],
    modeResult: (p: string, e: string) => e !== 'enquiry' && p === 'never'
      ? 'The customer sees no prices while choosing and downloads a quote with prices at the end.'
      : `The customer ${p === 'live' ? 'sees prices live' : p === 'end' ? 'sees the price only at the end' : p === 'range' ? 'sees an estimated range' : 'sees no prices'}, and at the end ${e === 'enquiry' ? 'sends an enquiry' : e === 'pdf' ? 'downloads the quote' : 'chooses between the quote and an enquiry'}.`,
    area: 'Installation area', areaHint: 'Countries where you install. A customer outside the area can still send an enquiry without installation.',
    areaSi: 'In Slovenia only these postal areas (none ticked = all of Slovenia):',
    cfgEnabled: 'Configurator is publicly available', cfgSlug: 'Page address', cfgShowPrices: 'Customer can see prices live while configuring',
    cfgAccent: 'Button colour', cfgIntro: 'Intro text', cfgLink: 'Link to the configurator', linkHint: 'Put the link on a button on your website (e.g. "Get a price") or send it to a customer.', copy: 'Copy', copied: 'Copied',
    open: 'Open', embed: 'Code to embed in your website', embedHint: 'If you want the configurator to show as part of your website, copy the code and paste it on the page (in WordPress or Wix into an HTML block).', slugInvalid: 'Address: 3–40 chars, lowercase letters, digits and dashes',
    slugTaken: 'This address is already taken',
    status: 'Configurator status', published: 'Published', notPublished: 'Not published',
    publishedHint: 'Customers can open the configurator at the link below and send you a request.',
    notPublishedHint: 'Your configurator is not published. Customers cannot see it at the link.',
    publish: 'Publish configurator', hide: 'Hide configurator', publishedToast: 'The configurator is published.', hiddenToast: 'The configurator is hidden.',
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
    endMode: ((company as any).configurator_end_mode as string | null) ?? 'enquiry',
    logoSize: ((company as any).configurator_logo_size as string | null) ?? 'm',
    accent: company.configurator_accent ?? '#2563eb',
    intro: company.configurator_intro ?? '',
    area: ((company as any).configurator_area as InstallArea | null) ?? DEFAULT_AREA,
    theme: ((company as any).configurator_theme as Record<string, string> | null) ?? {},
  })
  const [saving, setSaving] = useState(false)
  // a value equal to null/default is removed so only real changes are stored
  const setThemeValue = (k: string, v: string | null) => setForm(f => { const t = { ...f.theme }; if (v === null || (k === 'font' ? v === 'default' : v.toLowerCase() === (THEME_DEFAULTS as Record<string, string>)[k])) delete t[k]; else t[k] = v; return { ...f, theme: t } })
  const slugOk = /^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$/.test(form.slug)
  const url = `${window.location.origin}/k/${form.slug}`
  const embed = `<iframe src="${url}" style="width:100%;height:900px;border:0" title="Konfigurator oken"></iframe>`

  async function save() {
    if (!slugOk) { toast.error(T.slugInvalid); return }
    setSaving(true)
    const { error } = await supabase.from('companies').update({
      configurator_enabled: form.enabled, configurator_slug: form.slug,
      configurator_price_mode: form.priceMode, configurator_end_mode: form.endMode, configurator_logo_size: form.logoSize,
      // the page needs the prices unless they are never shown and only an enquiry is sent
      configurator_show_prices: !(form.priceMode === 'never' && form.endMode === 'enquiry'),
      configurator_accent: form.accent, configurator_intro: form.intro.trim() || null, configurator_area: form.area,
      // only what differs from the default is stored; nothing changed = null
      configurator_theme: Object.keys(form.theme).length ? form.theme : null,
    } as any).eq('id', company.id)
    setSaving(false)
    if (error) { toast.error(error.code === '23505' ? T.slugTaken : error.message); return }
    toast.success(T.saved); onSaved()
  }
  const [toggling, setToggling] = useState(false)
  async function setPublished(on: boolean) {
    if (on && !slugOk) { toast.error(T.slugInvalid); return }
    setToggling(true)
    const { error } = await supabase.from('companies').update({ configurator_enabled: on, ...(on ? { configurator_slug: form.slug } : {}) } as any).eq('id', company.id)
    setToggling(false)
    if (error) { toast.error(error.code === '23505' ? T.slugTaken : error.message); return }
    setForm(f => ({ ...f, enabled: on }))
    toast.success(on ? T.publishedToast : T.hiddenToast); onSaved()
  }
  function copy(text: string) { navigator.clipboard.writeText(text).then(() => toast.success(T.copied)) }

  return <div className="form-scope px-6 py-6 max-w-3xl mx-auto space-y-4">
    <Card className="p-5 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[240px]">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">{T.status}</h2>
          <span className={form.enabled ? 'inline-flex items-center h-[22px] px-2 rounded-md text-[13px] font-medium bg-[#dbfce7] text-[#267a47]' : 'inline-flex items-center h-[22px] px-2 rounded-md text-[13px] font-medium bg-[#eeeff1] text-[#52525b]'}>{form.enabled ? T.published : T.notPublished}</span>
        </div>
        <p className="text-sm font-medium text-[#5e5e5e] mt-1">{form.enabled ? T.publishedHint : T.notPublishedHint}</p>
      </div>
      {canEdit && (form.enabled
        ? <Button variant="secondary" loading={toggling} onClick={() => setPublished(false)}>{T.hide}</Button>
        : <Button loading={toggling} onClick={() => setPublished(true)}>{T.publish}</Button>)}
      {slugOk && <div className="basis-full flex flex-wrap items-center gap-2">
        <input readOnly value={url} className="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-gray-50" />
        <Button variant="secondary" className="gap-1.5" onClick={() => copy(url)}><Copy className="w-4 h-4" />{T.copy}</Button>
        <a href={url} target="_blank" rel="noreferrer"><Button variant="secondary" className="gap-1.5"><ExternalLink className="w-4 h-4" />{T.open}</Button></a>
      </div>}
    </Card>

    <Card className="p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{T.modeTitle}</h2>
        <p className="text-sm font-medium text-[#5e5e5e] mt-1">{T.modeHint}</p>
      </div>
      <div className="grid gap-2">
        {T.combos.map(([pm, em, , hint]) => { const on = form.priceMode === pm && form.endMode === em
          return <button key={pm + em} type="button" disabled={!canEdit} onClick={() => setForm(f => ({ ...f, priceMode: pm, endMode: em }))}
            className={cn('text-left rounded-xl border px-4 py-3 transition-colors', on ? 'border-[#26897a] bg-[#eef8f6]' : 'border-gray-200 bg-white hover:border-gray-400')}>
            <div className="flex items-start gap-3">
              <span className={cn('w-4 h-4 mt-1 rounded-full border-2 shrink-0', on ? 'border-[#26897a] bg-[#26897a] shadow-[inset_0_0_0_2px_#fff]' : 'border-gray-300')} />
              <span className="text-[15px] leading-6 font-medium text-gray-900">{hint}</span>
            </div>
          </button> })}
      </div>
      {canEdit && <div className="flex justify-end"><Button onClick={save} loading={saving}>{T.save}</Button></div>}
    </Card>

    <Card className="p-5 space-y-4">
      <Input label={T.cfgSlug} value={form.slug} onChange={e => setForm({ ...form, slug: slugify(e.target.value) })} error={slugOk ? undefined : T.slugInvalid} disabled={!canEdit} />
      <div className="flex flex-col gap-1">
        <label>{T.logoSize}</label>
        <p className="text-sm font-medium text-[#5e5e5e]">{T.logoSizeHint}</p>
        <div className="inline-flex p-1 rounded-[10px] bg-[#f1f1f1] w-fit mt-1">
          {(['s', 'm', 'l'] as const).map(k => <button key={k} type="button" disabled={!canEdit} onClick={() => setForm(f => ({ ...f, logoSize: k }))}
            className={cn('h-9 px-4 rounded-lg text-sm font-semibold transition-colors', form.logoSize === k ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.1)]' : 'text-[#5e5e5e] hover:text-gray-900')}>
            {T.logoSizes[k]}</button>)}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <label>Izgled konfiguratorja</label>
          {Object.keys(form.theme).length > 0 && <button type="button" disabled={!canEdit} onClick={() => setForm(f => ({ ...f, theme: {} }))} className="text-sm font-medium text-[#5e5e5e] hover:text-gray-900 underline">Ponastavi na privzeto</button>}
        </div>
        <p className="text-sm font-medium text-[#5e5e5e]">Pisava in barve vaše strani. Kar ne spremenite, ostane privzeto.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-1">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-900">Pisava</span>
            <select disabled={!canEdit} value={form.theme.font ?? 'default'} onChange={e => setThemeValue('font', e.target.value)} className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm">
              {THEME_FONTS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
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
        </div>
        <div style={themeVars(form.theme)} className="cfg-public rounded-xl border p-4 mt-1 min-h-0">
          <div className="text-[17px] font-semibold text-gray-900">Kaj želite kupiti?</div>
          <div className="text-sm text-[#5e5e5e] mt-1">Tako bo videti vaš konfigurator.</div>
          <div className="mt-3 flex gap-2"><span className="inline-flex h-10 items-center rounded-xl bg-[#101112] px-4 text-sm font-semibold text-white">Naprej</span><span className="inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-900">Nazaj</span></div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label>{T.cfgAccent}</label>
        <div className="flex items-center gap-2">
          <input type="color" value={form.accent} onChange={e => setForm({ ...form, accent: e.target.value })} className="h-9 w-12 rounded border border-gray-200 bg-white p-1" />
          <span className="text-sm font-medium text-[#5e5e5e]">{form.accent}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label>{T.cfgIntro}</label>
        <textarea rows={3} value={form.intro} onChange={e => setForm({ ...form, intro: e.target.value })}
          className="w-full rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label>{T.area}</label>
        <p className="text-sm font-medium text-[#5e5e5e] mt-1 mb-3">{T.areaHint}</p>
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.map(c => { const on = form.area.countries.includes(c.code)
            return <button key={c.code} type="button" disabled={!canEdit}
              onClick={() => setForm(f => ({ ...f, area: { ...f.area, countries: on ? f.area.countries.filter(x => x !== c.code) : [...f.area.countries, c.code] } }))}
              className={cn('h-9 px-3.5 rounded-[10px] border text-sm font-medium transition-colors', on ? 'border-[#26897a] bg-[#eef8f6] text-gray-900' : 'border-gray-200 bg-white text-[#5e5e5e] hover:border-gray-400')}>{c.sl}</button> })}
        </div>
        {form.area.countries.includes('SI') && <div className="mt-4">
          <p className="text-sm font-medium text-[#5e5e5e] mb-2">{T.areaSi}</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {SI_AREAS.map(a => <Checkbox key={a.key} checked={form.area.si_areas.includes(a.key)} label={a.sl}
              onChange={on => setForm(f => ({ ...f, area: { ...f.area, si_areas: on ? [...f.area.si_areas, a.key] : f.area.si_areas.filter(x => x !== a.key) } }))} />)}
          </div>
        </div>}
      </div>
      {canEdit && <div className="flex justify-end"><Button onClick={save} loading={saving}>{T.save}</Button></div>}
    </Card>

    <Card className="p-5 space-y-3">
      <div><h2 className="text-base font-semibold text-gray-900">{T.cfgLink}</h2><p className="text-sm font-medium text-[#5e5e5e] mt-1">{T.linkHint}</p></div>
      <div className="flex gap-2">
        <input readOnly value={url} className="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-gray-50" />
        <Button variant="secondary" className="gap-1.5" onClick={() => copy(url)}><Copy className="w-4 h-4" />{T.copy}</Button>
        <a href={url} target="_blank" rel="noreferrer"><Button variant="secondary" className="gap-1.5"><ExternalLink className="w-4 h-4" />{T.open}</Button></a>
      </div>
      <div className="pt-2"><h3 className="text-base font-semibold text-gray-900">{T.embed}</h3><p className="text-sm font-medium text-[#5e5e5e] mt-1">{T.embedHint}</p></div>
      <div className="flex gap-2">
        <textarea readOnly rows={2} value={embed} className="flex-1 min-w-0 font-mono text-xs rounded-lg border border-gray-200 px-3 py-2 text-gray-700 bg-gray-50" />
        <Button variant="secondary" className="gap-1.5 self-start" onClick={() => copy(embed)}><Copy className="w-4 h-4" />{T.copy}</Button>
      </div>
    </Card>
  </div>
}
