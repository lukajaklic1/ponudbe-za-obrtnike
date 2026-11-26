import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { House, Plus, ExternalLink, Copy, Inbox, FileText, Send, Ruler, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { PageHeader } from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { QuoteStatusBadge } from '../components/ui/QuoteStatusBadge'
import { toast } from '../components/ui/Toast'
import type { QuoteStatus } from '../types/database'

interface Row {
  id: string; quote_number: string; status: QuoteStatus; total_net: number | null; created_at: string; updated_at: string
  sent_at: string | null; viewed_at: string | null; source: string | null
  customers: { name: string } | null
}

const DAY = 86400000

/** Where a user lands after signing in: what needs doing today, the latest quotes, the shortcuts. */
export default function HomePage() {
  const { company, profile, hasPerm } = useCompany()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const sl = lang !== 'en'
  const [rows, setRows] = useState<Row[] | null>(null)
  const canQuotes = hasPerm('quotes', 'view')

  useEffect(() => {
    if (!company || !canQuotes) { setRows([]); return }
    supabase.from('quotes').select('id, quote_number, status, total_net, created_at, updated_at, sent_at, viewed_at, source, customers(name)')
      .eq('company_id', company.id).order('updated_at', { ascending: false }).limit(500)
      .then(({ data }: { data: unknown }) => setRows((data as Row[] | null) ?? []))
  }, [company?.id, canQuotes])

  const money = (n: number | null) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: company?.currency ?? 'EUR' })
  const list = rows ?? []
  const count = (f: (q: Row) => boolean) => list.filter(f).length
  const enquiries = count(q => q.status === 'enquiry')
  const unseen = count(q => q.status === 'enquiry' && q.source === 'configurator' && !q.viewed_at)
  const drafts = count(q => q.status === 'draft')
  const waiting = count(q => q.status === 'sent' || q.status === 'downloaded')
  const stale = count(q => (q.status === 'sent' || q.status === 'downloaded') && Date.now() - Date.parse(q.sent_at ?? q.updated_at) > 7 * DAY)
  const measuring = count(q => q.status === 'measure')

  const hour = new Date().getHours()
  const hello = sl ? (hour < 12 ? 'Dobro jutro' : hour < 18 ? 'Dober dan' : 'Dober večer') : (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')
  const today = new Date().toLocaleDateString(sl ? 'sl-SI' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const publicUrl = company?.configurator_enabled && company.configurator_slug ? `${window.location.origin}/k/${company.configurator_slug}` : null

  const tiles = [
    { icon: Inbox, bg: '#feeee1', color: '#9e3f00', label: sl ? 'Povpraševanja' : 'Enquiries', value: enquiries, sub: unseen ? (sl ? `${unseen} novih` : `${unseen} new`) : (sl ? 'čakajo na ponudbo' : 'waiting for an offer') },
    { icon: FileText, bg: '#eeeff1', color: '#52525b', label: sl ? 'Osnutki' : 'Drafts', value: drafts, sub: sl ? 'v pripravi' : 'in progress' },
    { icon: Send, bg: '#fef3cd', color: '#8a6100', label: sl ? 'Čakajo na odgovor' : 'Waiting for an answer', value: waiting, sub: stale ? (sl ? `${stale} starejših od 7 dni` : `${stale} older than 7 days`) : (sl ? 'poslane in prenesene' : 'sent and downloaded') },
    { icon: Ruler, bg: '#dcf5f4', color: '#0c6b6b', label: sl ? 'Izmere' : 'Measurements', value: measuring, sub: sl ? 'v teku' : 'in progress' },
  ]

  return (
    <div>
      <PageHeader title={t.nav.home} icon={House}
        action={hasPerm('quotes', 'create') && <Button onClick={() => navigate('/quotes/new')} className="gap-1.5"><Plus className="w-4 h-4" />{sl ? 'Nova ponudba' : 'New quote'}</Button>} />
      <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-gray-900">{hello}{profile?.first_name ? `, ${profile.first_name}` : ''}</h1>
          <p className="text-sm font-medium text-[#5e5e5e] mt-1 capitalize-first">{today}</p>
        </div>

        {canQuotes && <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">{sl ? 'Za danes' : 'For today'}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {tiles.map(x => (
              <Link key={x.label} to="/quotes" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-400 transition-colors block">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: x.bg }}><x.icon className="w-4 h-4" style={{ color: x.color }} /></div>
                  <span className="text-2xl font-bold tracking-[-0.02em] text-gray-900 tabular-nums">{rows === null ? '–' : x.value}</span>
                </div>
                <div className="text-sm font-medium text-gray-900">{x.label}</div>
                <div className="text-xs font-medium text-[#7f7f7f] mt-0.5">{x.sub}</div>
              </Link>
            ))}
          </div>
        </section>}

        {canQuotes && <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-sm font-semibold text-gray-900">{sl ? 'Zadnje ponudbe' : 'Latest quotes'}</h2>
            <Link to="/quotes" className="inline-flex items-center gap-1 text-sm font-medium text-[#5e5e5e] hover:text-gray-900">{sl ? 'Vse ponudbe' : 'All quotes'}<ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
          {rows !== null && list.length === 0
            ? <p className="px-5 pb-6 text-sm font-medium text-[#7f7f7f]">{sl ? 'Ponudb še ni. Ustvarite prvo ali delite povezavo do konfiguratorja.' : 'No quotes yet. Create the first one or share the configurator link.'}</p>
            : <div className="divide-y divide-gray-200 border-t border-gray-200">
              {list.slice(0, 6).map(q => {
                const days = Math.floor((Date.now() - Date.parse(q.updated_at)) / DAY)
                return <Link key={q.id} to={`/quotes/${q.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <span className="w-28 shrink-0 text-sm font-semibold text-gray-900">{q.quote_number}</span>
                  <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-900">{q.customers?.name ?? '—'}</span>
                  <span className="hidden sm:block"><QuoteStatusBadge status={q.status} label={t.qp.status[q.status] ?? q.status} /></span>
                  <span className="w-28 shrink-0 text-right text-sm font-medium text-gray-900 tabular-nums">{money(q.total_net)}</span>
                  <span className="hidden md:block w-20 shrink-0 text-right text-xs font-medium text-[#7f7f7f]">{days <= 0 ? (sl ? 'danes' : 'today') : sl ? `pred ${days} d` : `${days} d ago`}</span>
                </Link>
              })}
            </div>}
        </section>}

        {publicUrl && <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900">{sl ? 'Vaš konfigurator' : 'Your configurator'}</h2>
          <p className="text-sm font-medium text-[#5e5e5e] mt-1">{sl ? 'Povezavo delite s strankami ali jo dodate na svojo spletno stran.' : 'Share the link with customers or add it to your website.'}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="flex-1 min-w-[220px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 truncate">{publicUrl}</div>
            <Button variant="secondary" className="gap-1.5" onClick={() => { navigator.clipboard.writeText(publicUrl).then(() => toast.success(sl ? 'Kopirano' : 'Copied')) }}><Copy className="w-4 h-4" />{sl ? 'Kopiraj' : 'Copy'}</Button>
            <a href={publicUrl} target="_blank" rel="noreferrer"><Button variant="secondary" className="gap-1.5"><ExternalLink className="w-4 h-4" />{sl ? 'Odpri' : 'Open'}</Button></a>
          </div>
        </section>}
      </div>
    </div>
  )
}
