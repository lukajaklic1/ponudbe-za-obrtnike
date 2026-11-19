import { useState } from 'react'
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

const TXT = {
  sl: {
    title: 'Objava', save: 'Shrani', saved: 'Shranjeno.',
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
          <span className={form.enabled ? 'inline-flex items-center h-[22px] px-2 rounded-md text-[13px] font-medium bg-[#dbfce7] text-[#267a47]' : 'inline-flex items-center h-[22px] px-2 rounded-md text-[13px] font-medium bg-[#ececec] text-[#4a4a4a]'}>{form.enabled ? T.published : T.notPublished}</span>
        </div>
        <p className="text-sm font-medium text-[#4f4f4f] mt-1">{form.enabled ? T.publishedHint : T.notPublishedHint}</p>
      </div>
      {canEdit && (form.enabled
        ? <Button variant="secondary" loading={toggling} onClick={() => setPublished(false)}>{T.hide}</Button>
        : <Button loading={toggling} onClick={() => setPublished(true)}>{T.publish}</Button>)}
    </Card>

    <Card className="p-5 space-y-4">
      <Input label={T.cfgSlug} value={form.slug} onChange={e => setForm({ ...form, slug: slugify(e.target.value) })} error={slugOk ? undefined : T.slugInvalid} disabled={!canEdit} />
      <Checkbox checked={form.show} onChange={v => setForm({ ...form, show: v })} label={T.cfgShowPrices} />
      <div className="flex flex-col gap-1">
        <label>{T.cfgAccent}</label>
        <div className="flex items-center gap-2">
          <input type="color" value={form.accent} onChange={e => setForm({ ...form, accent: e.target.value })} className="h-9 w-12 rounded border border-gray-200 bg-white p-1" />
          <span className="text-sm font-medium text-[#4f4f4f]">{form.accent}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label>{T.cfgIntro}</label>
        <textarea rows={3} value={form.intro} onChange={e => setForm({ ...form, intro: e.target.value })}
          className="w-full rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {canEdit && <div className="flex justify-end"><Button onClick={save} loading={saving}>{T.save}</Button></div>}
    </Card>

    <Card className="p-5 space-y-3">
      <div><h2 className="text-base font-semibold text-gray-900">{T.cfgLink}</h2><p className="text-sm font-medium text-[#4f4f4f] mt-1">{T.linkHint}</p></div>
      <div className="flex gap-2">
        <input readOnly value={url} className="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-gray-50" />
        <Button variant="secondary" className="gap-1.5" onClick={() => copy(url)}><Copy className="w-4 h-4" />{T.copy}</Button>
        <a href={url} target="_blank" rel="noreferrer"><Button variant="secondary" className="gap-1.5"><ExternalLink className="w-4 h-4" />{T.open}</Button></a>
      </div>
      <div className="pt-2"><h3 className="text-base font-semibold text-gray-900">{T.embed}</h3><p className="text-sm font-medium text-[#4f4f4f] mt-1">{T.embedHint}</p></div>
      <div className="flex gap-2">
        <textarea readOnly rows={2} value={embed} className="flex-1 min-w-0 font-mono text-xs rounded-lg border border-gray-200 px-3 py-2 text-gray-700 bg-gray-50" />
        <Button variant="secondary" className="gap-1.5 self-start" onClick={() => copy(embed)}><Copy className="w-4 h-4" />{T.copy}</Button>
      </div>
    </Card>
  </div>
}
