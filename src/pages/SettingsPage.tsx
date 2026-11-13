import { useEffect, useRef, useState } from 'react'
import { Building2, Receipt, CreditCard, Settings, Plus, X, Wallet, Check, Upload, AlertCircle, Image as ImageIcon } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import Button from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import Input from '../components/ui/Input'
import NumberInput from '../components/ui/NumberInput'
import Checkbox from '../components/ui/Checkbox'
import { currencySymbol } from '../lib/currency'
import { INCOTERMS } from '../lib/incoterms'
import type { Company } from '../types/database'

const LBL = {
  sl: {
    logo: 'Logotip', logoHint: 'Kliknite ali povlecite sliko sem. PNG, JPG, SVG ali WEBP, največ 2 MB.', uploadLogo: 'Naloži logotip', replaceLogo: 'Zamenjaj logotip', uploading: 'Nalagam…', removeLogo: 'Odstrani',
    taxId: 'Davčna številka / ID za DDV',
    website: 'Spletna stran',
    vatNote: 'Opomba za nezavezance za DDV', vatNoteHint: 'Izpiše se na ponudbi, če niste zavezanec za DDV (94. člen ZDDV-1).',
    bic: 'BIC / SWIFT',
    missing: 'Manjkajo obvezni podatki za ponudbe', missingHint: 'Brez teh podatkov ponudbe niso skladne z zakonom (ZGD-1):',
    complete: 'Vsi obvezni podatki za ponudbe so izpolnjeni.',
  },
  en: {
    logo: 'Logo', logoHint: 'Click or drop an image here. PNG, JPG, SVG or WEBP, max 2 MB.', uploadLogo: 'Upload logo', replaceLogo: 'Replace logo', uploading: 'Uploading…', removeLogo: 'Remove',
    taxId: 'Tax number / VAT ID',
    website: 'Website',
    vatNote: 'Note for non-VAT payers', vatNoteHint: 'Required on invoices if you are not VAT registered.',
    bic: 'BIC / SWIFT',
    missing: 'Required data for quotes is missing', missingHint: 'Without it your documents are not legally complete:',
    complete: 'All required quote data is filled in.',
  },
}

// Same look as the Input component, so every field on the page matches the rest of the app
const LABEL = 'block text-xs font-medium text-[#7f7f7f] mb-1'
const SELECT = 'block w-full h-[37.6px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed'
const TEXTAREA = 'block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y disabled:bg-gray-50 disabled:cursor-not-allowed'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HRK']

export default function SettingsPage() {
  const { company, loading, refetch, isAdmin } = useCompany()
  const { t, lang } = useLanguage()
  const s = t.qp
  const o = t.od
  const [form, setForm] = useState<Partial<Company>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const logoInput = useRef<HTMLInputElement>(null)
  const x = LBL[lang === 'en' ? 'en' : 'sl']

  useEffect(() => { if (company) setForm(company) }, [company])

  function field(key: keyof Company) {
    return {
      value: (form[key] as string) ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value })),
    }
  }

  // Payment terms list editor (stored as JSON array on the company)
  const terms = (form.payment_terms_list ?? []) as string[]
  const setTerms = (list: string[]) => setForm(f => ({ ...f, payment_terms_list: list }))
  const [termsSaved, setTermsSaved] = useState(false)

  // Autosave: the list is small and edited row by row, so every change is written right away
  // (no refetch — that would reset unsaved edits in the other sections).
  async function saveTerms(list: string[], def: string | null | undefined) {
    if (!company) return
    const clean = list.map(x => x.trim()).filter(Boolean)
    const defaultTerm = def && clean.includes(def.trim()) ? def.trim() : null
    const { error } = await supabase.from('companies').update({ payment_terms_list: clean, default_payment_terms: defaultTerm, updated_at: new Date().toISOString() }).eq('id', company.id)
    if (error) { toast.error(error.message); return }
    setTermsSaved(true)
    setTimeout(() => setTermsSaved(false), 1800)
  }

  async function save(section: string, fields: (keyof Company)[]) {
    if (!company) return
    setSaving(section)
    const patch = Object.fromEntries(fields.map(k => [k, form[k] ?? null]))
    const { error } = await supabase.from('companies').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', company.id)
    setSaving(null)
    if (error) { toast.error(error.message); return }
    toast.success(t.common.saved); refetch()
  }

  async function uploadLogo(file: File) {
    if (!company) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2 MB'); return }
    setUploading(true)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${company.id}/logo-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { setUploading(false); toast.error(upErr.message); return }
    const url = supabase.storage.from('logos').getPublicUrl(path).data.publicUrl
    const { error } = await supabase.from('companies').update({ logo_url: url, updated_at: new Date().toISOString() }).eq('id', company.id)
    setUploading(false)
    if (error) { toast.error(error.message); return }
    setForm(f => ({ ...f, logo_url: url })); toast.success(t.common.saved)
    await deleteLogoFiles(path)
  }

  // Only the current logo is kept; PDFs always use the company's current logo, so old files are never needed
  async function deleteLogoFiles(keep?: string) {
    if (!company) return
    const { data } = await supabase.storage.from('logos').list(company.id)
    const old = (data ?? []).map((f: { name: string }) => `${company.id}/${f.name}`).filter((p: string) => p !== keep)
    if (old.length) await supabase.storage.from('logos').remove(old)
  }

  async function removeLogo() {
    if (!company) return
    const { error } = await supabase.from('companies').update({ logo_url: null, updated_at: new Date().toISOString() }).eq('id', company.id)
    if (error) { toast.error(error.message); return }
    setForm(f => ({ ...f, logo_url: null }))
    await deleteLogoFiles()
  }

  // Data the law requires on business documents (ZDDV-1 82. člen, ZGD-1 30. člen) — checked on the saved company
  const isCapital = company?.legal_form === 'doo' || company?.legal_form === 'dd'
  const missing = company ? ([
    [!company.name, s.companyName],
    [!company.legal_form, o.legalForm],
    [!company.address_street || !company.address_city || !company.address_postal_code, t.common.streetAddress],
    [!company.registration_number, o.registrationNumber],
    [!company.tax_id, x.taxId],
    [!company.bank_iban, 'IBAN'],
    [isCapital && !company.registry_authority, o.registryAuthority],
    [isCapital && company.share_capital == null, o.shareCapital],
  ] as [boolean, string][]).filter(([m]) => m).map(([, label]) => label) : []

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" /></div>
  if (!isAdmin) return <Navigate to="/dashboard" replace />

  const prefix = form.quote_prefix || 'P'
  const nextNum = (form.quote_counter ?? 0) + 1
  const year = new Date().getFullYear()
  const preview = `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`

  return (
    <div>
      <PageHeader title={t.nav.settings} icon={Settings} />
      <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex flex-col gap-6"><fieldset disabled={!isAdmin} className="contents">
        {missing.length > 0
          ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div><div className="font-medium">{x.missing}</div><div className="text-amber-800 mt-0.5">{x.missingHint} {missing.join(', ')}.</div></div>
            </div>
          : <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 flex items-center gap-2"><Check className="w-4 h-4 text-green-600" />{x.complete}</div>}

        {/* Company profile */}
        <Section icon={Building2} title={s.companyProfile}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2"><Input id="name" label={s.companyName} {...field('name')} /></div>
            <div>
              <label className={LABEL}>{o.legalForm}</label>
              <select value={form.legal_form ?? ''} onChange={e => setForm(f => ({ ...f, legal_form: (e.target.value || null) as Company['legal_form'] }))}
                className={SELECT}>
                <option value="">{t.common.select}</option>
                <option value="sp">s.p.</option>
                <option value="doo">d.o.o.</option>
                <option value="dd">d.d.</option>
                <option value="other">{o.legalFormOther}</option>
              </select>
            </div>
            <Input id="registration_number" label={o.registrationNumber} {...field('registration_number')} />
            <Input id="tax_id" label={x.taxId} placeholder="SI12345678" {...field('tax_id')} />
            <Input id="phone" label={t.common.phone} {...field('phone')} />
            <Input id="email" label={t.common.email} type="email" {...field('email')} />
            <Input id="website" label={x.website} placeholder="www.podjetje.si" {...field('website')} />
            <Input id="address_street" label={t.common.streetAddress} {...field('address_street')} />
            <Input id="address_city" label={t.common.city} {...field('address_city')} />
            <Input id="address_postal_code" label={t.common.postalCode} {...field('address_postal_code')} />
            <Input id="address_country" label={t.common.country} {...field('address_country')} />
            {/* Companies (d.o.o., d.d.) must also state the registry and share capital on business documents */}
            {(form.legal_form === 'doo' || form.legal_form === 'dd') && <>
              <div className="col-span-2"><Input id="registry_authority" label={o.registryAuthority} placeholder={o.registryAuthorityHint} {...field('registry_authority')} /></div>
              <NumberInput label={o.shareCapital} unit="€" value={form.share_capital ?? null} decimals={2} onValue={v => setForm(f => ({ ...f, share_capital: v }))} />
              <NumberInput label={o.unpaidCapital} unit="€" value={form.unpaid_capital ?? null} decimals={2} onValue={v => setForm(f => ({ ...f, unpaid_capital: v }))} />
            </>}
          </div>
          <p className="text-xs font-medium text-[#7f7f7f] mt-3">{o.legalHint}</p>
          <div className="mt-5">
            <span className={LABEL}>{x.logo}</span>
            <div role="button" tabIndex={0}
              onClick={() => !uploading && logoInput.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') logoInput.current?.click() }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) uploadLogo(f) }}
              className={cn('flex items-center gap-5 rounded-lg border border-dashed px-5 py-6 cursor-pointer transition-colors', dragOver ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50/60')}>
              <div className="w-36 h-20 rounded-md border border-gray-200 bg-white flex items-center justify-center overflow-hidden shrink-0"
                style={form.logo_url ? undefined : { backgroundImage: 'linear-gradient(45deg,#f4f4f5 25%,transparent 25%,transparent 75%,#f4f4f5 75%),linear-gradient(45deg,#f4f4f5 25%,transparent 25%,transparent 75%,#f4f4f5 75%)', backgroundSize: '12px 12px', backgroundPosition: '0 0,6px 6px' }}>
                {form.logo_url ? <img src={form.logo_url} alt="" className="max-w-full max-h-full object-contain p-2" /> : <ImageIcon className="w-5 h-5 text-gray-300" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  <Upload className="w-3.5 h-3.5 text-gray-500" />
                  {uploading ? x.uploading : form.logo_url ? x.replaceLogo : x.uploadLogo}
                </div>
                <p className="text-xs font-medium text-[#7f7f7f] mt-0.5">{x.logoHint}</p>
              </div>
              {form.logo_url && <button type="button" onClick={e => { e.stopPropagation(); removeLogo() }}
                className="shrink-0 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50">{x.removeLogo}</button>}
            </div>
            <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }} />
          </div>
          {isAdmin && <SaveRow loading={saving === 'profile'} onClick={() => save('profile', ['name', 'email', 'phone', 'tax_id', 'address_street', 'address_city', 'address_postal_code', 'address_country', 'legal_form', 'registration_number', 'registry_authority', 'share_capital', 'unpaid_capital', 'website'])} label={t.common.save} />}
        </Section>

        {/* Quote settings */}
        <Section icon={Receipt} title={s.quoteSettings}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>{t.settings.currency}</label>
              <select value={form.currency ?? 'EUR'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className={SELECT}>
                {CURRENCIES.map(c => <option key={c} value={c}>{currencySymbol(c)} · {c}</option>)}
              </select>
            </div>
            <Input id="quote_prefix" label={s.quotePrefix} {...field('quote_prefix')} />
            <Input id="next_num" label={s.nextQuoteNumber} type="number" value={String(nextNum)}
              onChange={e => setForm(f => ({ ...f, quote_counter: Math.max(0, (parseInt(e.target.value) || 1) - 1) }))} />
          </div>
          <p className="text-xs font-medium text-[#7f7f7f] mt-2">{s.nextQuoteWillBe}: <span className="text-gray-600">{preview}</span></p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
            <Input id="valid_days" label={o.validDays} type="number" min={1} value={String(form.default_valid_days ?? 30)}
              onChange={e => setForm(f => ({ ...f, default_valid_days: Math.max(1, parseInt(e.target.value) || 30) }))} />
            <div className="sm:col-span-2">
              <label className={LABEL}>{o.defaultParity}</label>
              <select value={form.default_parity ?? ''} onChange={e => setForm(f => ({ ...f, default_parity: e.target.value || null }))}
                className={SELECT}>
                <option value="">{o.none}</option>
                {INCOTERMS.map(i => <option key={i.code} value={i.code}>{i.code} · {i.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5">
            <Checkbox checked={form.vat_payer === false} onChange={v => setForm(f => ({ ...f, vat_payer: !v, vat_exempt_note: v && !f.vat_exempt_note ? 'DDV ni obračunan na podlagi 1. odstavka 94. člena ZDDV-1.' : f.vat_exempt_note }))}
              label={lang === 'sl' ? 'Nisem zavezanec za DDV (cene v ponudbah in konfiguratorju so brez DDV)' : 'Not VAT registered (quote and configurator prices without VAT)'} />
            {form.vat_payer === false && <div className="mt-3">
              <Input id="vat_exempt_note" label={x.vatNote} {...field('vat_exempt_note')} />
              <p className="text-xs font-medium text-[#7f7f7f] mt-1">{x.vatNoteHint}</p>
            </div>}
          </div>

          {isAdmin && <SaveRow loading={saving === 'quote'} onClick={() => save('quote', ['currency', 'quote_prefix', 'quote_counter', 'default_valid_days', 'default_parity', 'vat_payer', 'vat_exempt_note'])} label={t.common.save} />}
        </Section>

        {/* Payment terms — the company's list; one is preselected on new quotes */}
        <Section icon={Wallet} title={s.paymentTerms}
          aside={termsSaved && <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Check className="w-3.5 h-3.5" />{t.common.saved}</span>}>
          <div>
            <p className="text-xs font-medium text-[#7f7f7f] mb-4">{o.paymentTermsHint}</p>
            <div className="flex flex-col gap-2">
              {terms.map((term, i) => (
                <div key={i} className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0 cursor-pointer" title={o.defaultTerm}>
                    <input type="radio" name="default_term" checked={!!term && form.default_payment_terms === term}
                      onChange={() => { setForm(f => ({ ...f, default_payment_terms: term })); saveTerms(terms, term) }} className="accent-gray-900" />
                    {o.defaultShort}
                  </label>
                  <div className="flex-1"><Input id={"term-" + i} value={term} placeholder={o.paymentHint}
                    onChange={e => {
                      const v = e.target.value
                      const wasDefault = form.default_payment_terms === term
                      setTerms(terms.map((x, j) => j === i ? v : x))
                      if (wasDefault) setForm(f => ({ ...f, default_payment_terms: v }))
                    }}
                    onBlur={() => saveTerms(terms, form.default_payment_terms)} /></div>
                  <button type="button" onClick={() => {
                    const next = terms.filter((_, j) => j !== i)
                    const def = form.default_payment_terms === term ? null : form.default_payment_terms
                    setForm(f => ({ ...f, payment_terms_list: next, default_payment_terms: def }))
                    saveTerms(next, def)
                  }} className="p-1.5 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => setTerms([...terms, ''])}
                className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 font-medium self-start mt-3"><Plus className="w-4 h-4" />{o.addPaymentTerm}</button>
            </div>
          </div>
        </Section>

        {/* Bank details */}
        <Section icon={CreditCard} title={s.bankDetails}>
          <p className="text-xs font-medium text-[#7f7f7f] mb-4">{s.bankHint}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input id="bank_name" label={s.bankName} {...field('bank_name')} />
            <Input id="bank_iban" label="IBAN" {...field('bank_iban')} />
            <Input id="bank_bic" label={x.bic} {...field('bank_bic')} />
          </div>
          {isAdmin && <SaveRow loading={saving === 'bank'} onClick={() => save('bank', ['bank_name', 'bank_iban', 'bank_bic'])} label={t.common.save} />}
        </Section>

        {/* General terms */}
        <Section icon={Receipt} title={s.quoteTerms}>
          <p className="text-xs font-medium text-[#7f7f7f] mb-4">{s.quoteTermsHint}</p>
          <div className="flex flex-col gap-4">
            <div>
              <label className={LABEL}>{s.quoteTermsSl}</label>
              <textarea
                rows={6}
                value={form.quote_terms ?? ''}
                onChange={e => setForm(f => ({ ...f, quote_terms: e.target.value }))}
                className={TEXTAREA}
              />
            </div>
            <div>
              <label className={LABEL}>{s.quoteTermsEn}</label>
              <textarea
                rows={6}
                value={form.quote_terms_en ?? ''}
                onChange={e => setForm(f => ({ ...f, quote_terms_en: e.target.value }))}
                className={TEXTAREA}
              />
            </div>
          </div>
          {isAdmin && <SaveRow loading={saving === 'terms'} onClick={() => save('terms', ['quote_terms', 'quote_terms_en'])} label={t.common.save} />}
        </Section>
      </fieldset></div>
    </div>
    </div>
  )
}

function Section({ icon: Icon, title, aside, children }: { icon: React.ElementType; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
        <div className="w-8 h-8 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-gray-600" /></div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function SaveRow({ loading, onClick, label }: { loading: boolean; onClick: () => void; label: string }) {
  return <div className="mt-5 flex justify-end"><Button loading={loading} onClick={onClick}>{label}</Button></div>
}
