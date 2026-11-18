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
    title: 'Objava', save: 'Shrani',
    cfgEnabled: 'Konfigurator je javno dostopen', cfgSlug: 'Naslov strani', cfgShowPrices: 'Stranka vidi cene sproti',
    cfgAccent: 'Barva gumbov', cfgIntro: 'Uvodno besedilo', cfgLink: 'Povezava za tvojo spletno stran', copy: 'Kopiraj', copied: 'Kopirano',
    open: 'Odpri', embed: 'Vstavi v spletno stran (iframe)', slugInvalid: 'Naslov: 3–40 znakov, male črke, številke in vezaji',
    slugTaken: 'Ta naslov je že zaseden',
  },
  en: {
    title: 'Publishing', save: 'Save',
    cfgEnabled: 'Configurator is publicly available', cfgSlug: 'Page address', cfgShowPrices: 'Customer sees prices live',
    cfgAccent: 'Button colour', cfgIntro: 'Intro text', cfgLink: 'Link for your website', copy: 'Copy', copied: 'Copied',
    open: 'Open', embed: 'Embed in your website (iframe)', slugInvalid: 'Address: 3–40 chars, lowercase letters, digits and dashes',
    slugTaken: 'This address is already taken',
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
    toast.success(T.save + ' ✓'); onSaved()
  }
  function copy(text: string) { navigator.clipboard.writeText(text).then(() => toast.success(T.copied)) }

  return <div className="px-6 py-6 max-w-3xl space-y-4">
    <Card className="p-5 space-y-4">
      <Checkbox checked={form.enabled} onChange={v => setForm({ ...form, enabled: v })} label={T.cfgEnabled} />
      <Input label={T.cfgSlug} value={form.slug} onChange={e => setForm({ ...form, slug: slugify(e.target.value) })} error={slugOk ? undefined : T.slugInvalid} disabled={!canEdit} />
      <Checkbox checked={form.show} onChange={v => setForm({ ...form, show: v })} label={T.cfgShowPrices} />
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: '#4f4f4f' }}>{T.cfgAccent}</label>
        <div className="flex items-center gap-2">
          <input type="color" value={form.accent} onChange={e => setForm({ ...form, accent: e.target.value })} className="h-9 w-12 rounded border border-gray-200 bg-white p-1" />
          <span className="text-sm font-mono text-gray-600">{form.accent}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: '#4f4f4f' }}>{T.cfgIntro}</label>
        <textarea rows={3} value={form.intro} onChange={e => setForm({ ...form, intro: e.target.value })}
          className="w-full rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {canEdit && <div className="flex justify-end"><Button onClick={save} loading={saving}>{T.save}</Button></div>}
    </Card>

    <Card className="p-5 space-y-3">
      <h2 className="text-base font-semibold text-gray-900">{T.cfgLink}</h2>
      <div className="flex gap-2">
        <input readOnly value={url} className="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-gray-50" />
        <Button variant="secondary" className="gap-1.5" onClick={() => copy(url)}><Copy className="w-4 h-4" />{T.copy}</Button>
        <a href={url} target="_blank" rel="noreferrer"><Button variant="secondary" className="gap-1.5"><ExternalLink className="w-4 h-4" />{T.open}</Button></a>
      </div>
      <div className="text-xs font-medium" style={{ color: '#4f4f4f' }}>{T.embed}</div>
      <div className="flex gap-2">
        <textarea readOnly rows={2} value={embed} className="flex-1 min-w-0 font-mono text-xs rounded-lg border border-gray-200 px-3 py-2 text-gray-700 bg-gray-50" />
        <Button variant="secondary" className="gap-1.5 self-start" onClick={() => copy(embed)}><Copy className="w-4 h-4" />{T.copy}</Button>
      </div>
    </Card>
  </div>
}
