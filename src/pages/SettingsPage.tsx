import { useEffect, useState } from 'react'
import { Building2, Receipt, CreditCard, Settings, Plus, X, Wallet, Check, FileText } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HRK']

export default function SettingsPage() {
  const { company, loading, refetch, isAdmin } = useCompany()
  const { t, lang } = useLanguage()
  const s = t.qp
  const o = t.od
  const [form, setForm] = useState<Partial<Company>>({})
  const [saving, setSaving] = useState<string | null>(null)

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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
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
        {/* Company profile */}
        <Section icon={Building2} title={s.companyProfile}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2"><Input id="name" label={s.companyName} {...field('name')} /></div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#7f7f7f]">{o.legalForm}</label>
              <select value={form.legal_form ?? ''} onChange={e => setForm(f => ({ ...f, legal_form: (e.target.value || null) as Company['legal_form'] }))}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">{t.common.select}</option>
                <option value="sp">s.p.</option>
                <option value="doo">d.o.o.</option>
                <option value="dd">d.d.</option>
                <option value="other">{o.legalFormOther}</option>
              </select>
            </div>
            <Input id="registration_number" label={o.registrationNumber} {...field('registration_number')} />
            <Input id="tax_id" label={s.vatNumber} {...field('tax_id')} />
            <Input id="phone" label={t.common.phone} {...field('phone')} />
            <div className="col-span-2"><Input id="email" label={t.common.email} type="email" {...field('email')} /></div>
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
          <p className="text-xs text-gray-400 mt-3">{o.legalHint}</p>
          {isAdmin && <SaveRow loading={saving === 'profile'} onClick={() => save('profile', ['name', 'email', 'phone', 'tax_id', 'address_street', 'address_city', 'address_postal_code', 'address_country', 'legal_form', 'registration_number', 'registry_authority', 'share_capital', 'unpaid_capital'])} label={t.common.save} />}
        </Section>

        {/* Quote settings */}
        <Section icon={Receipt} title={s.quoteSettings}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#7f7f7f]">{t.settings.currency}</label>
              <select value={form.currency ?? 'EUR'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {CURRENCIES.map(c => <option key={c} value={c}>{currencySymbol(c)} · {c}</option>)}
              </select>
            </div>
            <Input id="quote_prefix" label={s.quotePrefix} {...field('quote_prefix')} />
            <Input id="next_num" label={s.nextQuoteNumber} type="number" value={String(nextNum)}
              onChange={e => setForm(f => ({ ...f, quote_counter: Math.max(0, (parseInt(e.target.value) || 1) - 1) }))} />
          </div>
          <p className="text-xs text-gray-400 mt-2">{s.nextQuoteWillBe}: <span className="text-gray-600">{preview}</span></p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
            <Input id="valid_days" label={o.validDays} type="number" min={1} value={String(form.default_valid_days ?? 30)}
              onChange={e => setForm(f => ({ ...f, default_valid_days: Math.max(1, parseInt(e.target.value) || 30) }))} />
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-[#7f7f7f]">{o.defaultParity}</label>
              <select value={form.default_parity ?? ''} onChange={e => setForm(f => ({ ...f, default_parity: e.target.value || null }))}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">{o.none}</option>
                {INCOTERMS.map(i => <option key={i.code} value={i.code}>{i.code} · {i.name}</option>)}
              </select>
            </div>
          </div>

          {isAdmin && <SaveRow loading={saving === 'quote'} onClick={() => save('quote', ['currency', 'quote_prefix', 'quote_counter', 'default_valid_days', 'default_parity'])} label={t.common.save} />}
        </Section>

        {/* Invoice settings */}
        <Section icon={FileText} title={lang === 'sl' ? 'Računi' : 'Invoices'}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input id="invoice_prefix" label={lang === 'sl' ? 'Predpona računa' : 'Invoice prefix'} {...field('invoice_prefix')} />
            <Input id="invoice_due_days" label={lang === 'sl' ? 'Rok plačila (dni)' : 'Payment due (days)'} type="number" min={0} value={String(form.invoice_due_days ?? 8)}
              onChange={e => setForm(f => ({ ...f, invoice_due_days: Math.max(0, parseInt(e.target.value) || 0) }))} />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#7f7f7f]">{lang === 'sl' ? 'Naslednji račun' : 'Next invoice'}</span>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{(form.invoice_prefix || 'R')}-{new Date().getFullYear()}-0001 …</div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{lang === 'sl' ? 'Številke računov tečejo zaporedno in se vsako leto začnejo znova. Sklic za plačilo se ustvari samodejno (SI00).' : 'Invoice numbers run sequentially and restart every year. The payment reference is created automatically (SI00).'}</p>
          <div className="mt-5 flex flex-col gap-4">
            <Checkbox checked={form.vat_payer === false} onChange={v => setForm(f => ({ ...f, vat_payer: !v }))}
              label={lang === 'sl' ? 'Nisem zavezanec za DDV (na računu se izpiše: »DDV ni obračunan na podlagi 1. odstavka 94. člena ZDDV-1.«)' : 'Not VAT registered (invoices state that no VAT is charged under Art. 94(1) ZDDV-1)'} />
            <div className="flex flex-col gap-1">
              <label htmlFor="invoice_note" className="text-xs font-medium text-[#7f7f7f]">{lang === 'sl' ? 'Opomba na vsakem računu (neobvezno)' : 'Note on every invoice (optional)'}</label>
              <textarea id="invoice_note" rows={2} value={form.invoice_note ?? ''} onChange={e => setForm(f => ({ ...f, invoice_note: e.target.value || null }))}
                placeholder={lang === 'sl' ? 'npr. Hvala za zaupanje! Pri plačilu navedite sklic.' : 'e.g. Thank you for your business!'}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>
          {isAdmin && <SaveRow loading={saving === 'invoice'} onClick={() => save('invoice', ['invoice_prefix', 'invoice_due_days', 'vat_payer', 'invoice_note'])} label={t.common.save} />}
        </Section>

        {/* Payment terms — the company's list; one is preselected on new quotes */}
        <Section icon={Wallet} title={s.paymentTerms}
          aside={termsSaved && <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Check className="w-3.5 h-3.5" />{t.common.saved}</span>}>
          <div>
            <p className="text-xs text-gray-400 mb-4">{o.paymentTermsHint}</p>
            <div className="flex flex-col gap-2">
              {terms.map((term, i) => (
                <div key={i} className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0 cursor-pointer" title={o.defaultTerm}>
                    <input type="radio" name="default_term" checked={!!term && form.default_payment_terms === term}
                      onChange={() => { setForm(f => ({ ...f, default_payment_terms: term })); saveTerms(terms, term) }} className="text-blue-600 focus:ring-blue-500" />
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
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium self-start mt-3"><Plus className="w-4 h-4" />{o.addPaymentTerm}</button>
            </div>
          </div>
        </Section>

        {/* Bank details */}
        <Section icon={CreditCard} title={s.bankDetails}>
          <p className="text-xs text-gray-400 mb-4">{s.bankHint}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input id="bank_name" label={s.bankName} {...field('bank_name')} />
            <Input id="bank_iban" label="IBAN" {...field('bank_iban')} />
          </div>
          {isAdmin && <SaveRow loading={saving === 'bank'} onClick={() => save('bank', ['bank_name', 'bank_iban'])} label={t.common.save} />}
        </Section>

        {/* General terms */}
        <Section icon={Receipt} title={s.quoteTerms}>
          <p className="text-xs text-gray-400 mb-4">{s.quoteTermsHint}</p>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-label mb-1">{s.quoteTermsSl}</label>
              <textarea
                rows={6}
                value={form.quote_terms ?? ''}
                onChange={e => setForm(f => ({ ...f, quote_terms: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-label mb-1">{s.quoteTermsEn}</label>
              <textarea
                rows={6}
                value={form.quote_terms_en ?? ''}
                onChange={e => setForm(f => ({ ...f, quote_terms_en: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
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
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
        <div className="p-2 bg-blue-50 rounded-lg"><Icon className="w-4 h-4 text-blue-600" /></div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function SaveRow({ loading, onClick, label }: { loading: boolean; onClick: () => void; label: string }) {
  return <div className="mt-5 flex justify-end"><Button loading={loading} onClick={onClick}>{label}</Button></div>
}
